const pool = require('../config/db');
const { enregistrerMouvement, ErreurHttp } = require('../utils/mouvements');
const { journaliser } = require('../utils/audit');
const { emettre } = require('../utils/evenements');

// GET /api/achats?statut=commande   (admin)
exports.getAll = async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.statut) {
      where = 'WHERE a.statut = ?';
      params.push(req.query.statut);
    }
    const [rows] = await pool.query(
      `SELECT a.*, f.nom AS fournisseur_nom,
              (SELECT COUNT(*) FROM achats_lignes l WHERE l.achat_id = a.id) AS nb_lignes
       FROM achats a
       JOIN fournisseurs f ON f.id = a.fournisseur_id
       ${where}
       ORDER BY a.date_achat DESC, a.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/achats/suggestions   (admin)
// Produits à réapprovisionner (stock <= seuil) avec une quantité conseillée : de quoi remonter à 2 x le seuil
exports.suggestions = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id AS produit_id, nom, stock, seuil_alerte,
              GREATEST(seuil_alerte * 2 - stock, 1) AS quantite_suggeree
       FROM produits
       WHERE stock <= seuil_alerte
       ORDER BY stock ASC, nom`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/achats/:id   (admin)
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, f.nom AS fournisseur_nom
       FROM achats a JOIN fournisseurs f ON f.id = a.fournisseur_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Achat introuvable' });
    }
    const [lignes] = await pool.query(
      `SELECT l.id, l.produit_id, p.nom AS produit_nom, l.quantite, l.cout_unitaire,
              (l.quantite * l.cout_unitaire) AS sous_total
       FROM achats_lignes l JOIN produits p ON p.id = l.produit_id
       WHERE l.achat_id = ? ORDER BY l.id`,
      [req.params.id]
    );
    res.json({ ...rows[0], lignes });
  } catch (err) {
    next(err);
  }
};

// POST /api/achats   body : { fournisseur_id, lignes: [ { produit_id, quantite, cout_unitaire } ] }
// Crée un bon de commande fournisseur (statut "commande"). Le stock n'augmente qu'à la réception.
exports.creer = async (req, res, next) => {
  const { fournisseur_id, lignes } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [fournisseurs] = await conn.query('SELECT id FROM fournisseurs WHERE id = ?', [fournisseur_id]);
    if (!fournisseurs[0]) {
      throw new ErreurHttp(404, 'Fournisseur introuvable');
    }

    let total = 0;
    for (const l of lignes) {
      const [produits] = await conn.query('SELECT id FROM produits WHERE id = ?', [l.produit_id]);
      if (!produits[0]) {
        throw new ErreurHttp(404, `Produit ${l.produit_id} introuvable`);
      }
      total += l.quantite * l.cout_unitaire;
    }
    total = Math.round(total * 100) / 100;

    const [achat] = await conn.query(
      'INSERT INTO achats (fournisseur_id, total, user_id) VALUES (?, ?, ?)',
      [fournisseur_id, total, req.user.id]
    );
    for (const l of lignes) {
      await conn.query(
        'INSERT INTO achats_lignes (achat_id, produit_id, quantite, cout_unitaire) VALUES (?, ?, ?, ?)',
        [achat.insertId, l.produit_id, l.quantite, l.cout_unitaire]
      );
    }

    await conn.commit();
    await journaliser(req, { action: 'creer', entite: 'achat', entite_id: achat.insertId, details: { fournisseur_id: req.body.fournisseur_id, total } });
    res.status(201).json({ id: achat.insertId, statut: 'commande', total, message: 'Achat créé' });
  } catch (err) {
    await conn.rollback();
    if (err instanceof ErreurHttp) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  } finally {
    conn.release();
  }
};

// PATCH /api/achats/:id/recevoir   (admin)
// Marque l'achat comme reçu : le stock de chaque produit augmente + trace dans l'historique.
exports.recevoir = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM achats WHERE id = ? FOR UPDATE', [req.params.id]);
    const achat = rows[0];
    if (!achat) {
      throw new ErreurHttp(404, 'Achat introuvable');
    }
    if (achat.statut !== 'commande') {
      throw new ErreurHttp(400, `Impossible de recevoir un achat au statut "${achat.statut}"`);
    }

    const [lignes] = await conn.query(
      'SELECT produit_id, quantite FROM achats_lignes WHERE achat_id = ? ORDER BY produit_id',
      [achat.id]
    );
    for (const l of lignes) {
      await conn.query('UPDATE produits SET stock = stock + ? WHERE id = ?', [l.quantite, l.produit_id]);
      await enregistrerMouvement(conn, {
        produit_id: l.produit_id,
        type: 'reception',
        quantite: l.quantite,
        user_id: req.user.id,
        achat_id: achat.id,
        motif: `Réception de l'achat n°${achat.id}`,
      });
    }
    await conn.query("UPDATE achats SET statut = 'recu', date_reception = NOW() WHERE id = ?", [achat.id]);

    await conn.commit();
    await journaliser(req, { action: 'recevoir', entite: 'achat', entite_id: achat.id, details: { total: Number(achat.total) } });
    emettre('achat.recu', { id: achat.id, total: Number(achat.total), nb_produits: lignes.length });
    res.json({ id: achat.id, statut: 'recu', message: 'Achat reçu, stock mis à jour' });
  } catch (err) {
    await conn.rollback();
    if (err instanceof ErreurHttp) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  } finally {
    conn.release();
  }
};

// PATCH /api/achats/:id/annuler   (admin) : seulement tant que l'achat n'est pas reçu
exports.annuler = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT statut FROM achats WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Achat introuvable' });
    }
    if (rows[0].statut !== 'commande') {
      return res.status(400).json({ message: `Impossible d'annuler un achat au statut "${rows[0].statut}"` });
    }
    await pool.query("UPDATE achats SET statut = 'annule' WHERE id = ?", [req.params.id]);
    await journaliser(req, { action: 'annuler', entite: 'achat', entite_id: Number(req.params.id) });
    res.json({ id: Number(req.params.id), statut: 'annule', message: 'Achat annulé' });
  } catch (err) {
    next(err);
  }
};
