const pool = require('../config/db');

const STATUTS_MODIFIABLES = ['en_attente', 'confirmee', 'expediee', 'livree'];

// Erreur "métier" : permet de renvoyer un code HTTP précis depuis une transaction
class ErreurHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// POST /api/commandes
// body : { "produits": [ { "produit_id": 1, "quantite": 2 }, { "produit_id": 3, "quantite": 1 } ] }
exports.creer = async (req, res, next) => {
  const { produits } = req.body;

  if (!Array.isArray(produits) || produits.length === 0) {
    return res.status(400).json({ message: 'La commande doit contenir au moins un produit' });
  }

  // Regroupe les doublons et valide les quantités
  const quantites = new Map();
  for (const item of produits) {
    const id = Number(item.produit_id);
    const qte = Number(item.quantite);
    if (!Number.isInteger(id) || !Number.isInteger(qte) || qte <= 0) {
      return res.status(400).json({ message: 'Chaque ligne doit avoir un produit_id et une quantite (entier > 0)' });
    }
    quantites.set(id, (quantites.get(id) || 0) + qte);
  }

  // Tri par id : évite les deadlocks quand deux commandes arrivent en même temps
  const lignes = [...quantites.entries()].sort((a, b) => a[0] - b[0]);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    const lignesCalculees = [];

    for (const [produitId, quantite] of lignes) {
      // FOR UPDATE verrouille la ligne : personne d'autre ne peut modifier ce stock pendant la transaction
      const [rows] = await conn.query('SELECT id, nom, prix, stock FROM produits WHERE id = ? FOR UPDATE', [produitId]);
      const produit = rows[0];

      if (!produit) {
        throw new ErreurHttp(404, `Produit ${produitId} introuvable`);
      }
      if (produit.stock < quantite) {
        throw new ErreurHttp(400, `Stock insuffisant pour "${produit.nom}" (disponible : ${produit.stock})`);
      }

      total += produit.prix * quantite;
      lignesCalculees.push({ produitId, quantite, prix: produit.prix });
    }

    total = Math.round(total * 100) / 100;

    const [commande] = await conn.query('INSERT INTO commandes (user_id, total) VALUES (?, ?)', [req.user.id, total]);

    for (const l of lignesCalculees) {
      await conn.query(
        'INSERT INTO lignes_commande (commande_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
        [commande.insertId, l.produitId, l.quantite, l.prix]
      );
      await conn.query('UPDATE produits SET stock = stock - ? WHERE id = ?', [l.quantite, l.produitId]);
    }

    await conn.commit();
    res.status(201).json({ id: commande.insertId, statut: 'en_attente', total, message: 'Commande créée' });
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

// GET /api/commandes/mes-commandes
exports.mesCommandes = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM commandes WHERE user_id = ? ORDER BY date_commande DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/commandes?statut=en_attente   (admin)
exports.getAll = async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.statut) {
      where = 'WHERE c.statut = ?';
      params.push(req.query.statut);
    }

    const [rows] = await pool.query(
      `SELECT c.*, u.nom AS client_nom, u.email AS client_email
       FROM commandes c
       JOIN users u ON u.id = c.user_id
       ${where}
       ORDER BY c.date_commande DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/commandes/:id   (propriétaire de la commande ou admin)
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM commandes WHERE id = ?', [req.params.id]);
    const commande = rows[0];

    if (!commande) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    if (req.user.role !== 'admin' && commande.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const [lignes] = await pool.query(
      `SELECT l.id, l.produit_id, p.nom AS produit_nom, l.quantite, l.prix_unitaire,
              (l.quantite * l.prix_unitaire) AS sous_total
       FROM lignes_commande l
       JOIN produits p ON p.id = l.produit_id
       WHERE l.commande_id = ?`,
      [commande.id]
    );

    res.json({ ...commande, lignes });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/commandes/:id/statut   body : { "statut": "confirmee" }   (admin)
exports.changerStatut = async (req, res, next) => {
  try {
    const { statut } = req.body;

    if (statut === 'annulee') {
      return res.status(400).json({ message: "Pour annuler une commande, utilisez PATCH /api/commandes/:id/annuler" });
    }
    if (!STATUTS_MODIFIABLES.includes(statut)) {
      return res.status(400).json({ message: `Statut invalide. Valeurs possibles : ${STATUTS_MODIFIABLES.join(', ')}` });
    }

    const [rows] = await pool.query('SELECT statut FROM commandes WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    if (rows[0].statut === 'annulee') {
      return res.status(400).json({ message: 'Une commande annulée ne peut plus changer de statut' });
    }

    await pool.query('UPDATE commandes SET statut = ? WHERE id = ?', [statut, req.params.id]);
    res.json({ id: Number(req.params.id), statut });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/commandes/:id/annuler   (propriétaire ou admin) → remet les quantités en stock
exports.annuler = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM commandes WHERE id = ? FOR UPDATE', [req.params.id]);
    const commande = rows[0];

    if (!commande) {
      throw new ErreurHttp(404, 'Commande introuvable');
    }
    if (req.user.role !== 'admin' && commande.user_id !== req.user.id) {
      throw new ErreurHttp(403, 'Accès refusé');
    }
    if (!['en_attente', 'confirmee'].includes(commande.statut)) {
      throw new ErreurHttp(400, `Impossible d'annuler une commande au statut "${commande.statut}"`);
    }

    // Remet en stock chaque produit de la commande
    await conn.query(
      `UPDATE produits p
       JOIN lignes_commande l ON l.produit_id = p.id
       SET p.stock = p.stock + l.quantite
       WHERE l.commande_id = ?`,
      [commande.id]
    );
    await conn.query("UPDATE commandes SET statut = 'annulee' WHERE id = ?", [commande.id]);

    await conn.commit();
    res.json({ id: commande.id, statut: 'annulee', message: 'Commande annulée, stock remis à jour' });
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
