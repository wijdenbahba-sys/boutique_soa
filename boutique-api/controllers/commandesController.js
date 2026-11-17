const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const { enregistrerMouvement, ErreurHttp } = require('../utils/mouvements');
const { lirePagination, construireTri, reponsePaginee } = require('../utils/pagination');

const STATUTS_MODIFIABLES = ['en_attente', 'confirmee', 'expediee', 'livree'];
const COLONNES_TRI = { date: 'c.date_commande', total: 'c.total', statut: 'c.statut', id: 'c.id' };

// POST /api/commandes
// body : { "produits": [ { "produit_id": 1, "quantite": 2 }, { "produit_id": 3, "quantite": 1 } ] }
exports.creer = async (req, res, next) => {
  // Regroupe les doublons (le corps est déjà validé par le middleware)
  const quantites = new Map();
  for (const { produit_id, quantite } of req.body.produits) {
    quantites.set(produit_id, (quantites.get(produit_id) || 0) + quantite);
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
      await enregistrerMouvement(conn, {
        produit_id: l.produitId,
        type: 'vente',
        quantite: -l.quantite,
        user_id: req.user.id,
        commande_id: commande.insertId,
        motif: `Commande n°${commande.insertId}`,
      });
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

// GET /api/commandes?statut=en_attente&tri=total&ordre=desc&page=1&limit=10   (admin)
// Sans "page" ni "limit" : tableau simple. Avec : { data, pagination }.
exports.getAll = async (req, res, next) => {
  try {
    const params = [];
    let where = '';
    if (req.query.statut) {
      where = 'WHERE c.statut = ?';
      params.push(req.query.statut);
    }

    const tri = construireTri(req.query, COLONNES_TRI, 'c.date_commande');
    // Par défaut : les plus récentes d'abord
    const ordre = req.query.ordre ? tri.sql : 'ORDER BY c.date_commande DESC';
    const pag = lirePagination(req.query);

    const sql = `SELECT c.*, u.nom AS client_nom, u.email AS client_email
                 FROM commandes c
                 JOIN users u ON u.id = c.user_id
                 ${where}
                 ${ordre}`;

    if (!pag.pagine) {
      const [rows] = await pool.query(sql, params);
      return res.json(rows);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM commandes c ${where}`, params);
    const [rows] = await pool.query(`${sql} LIMIT ? OFFSET ?`, [...params, pag.limit, pag.offset]);
    res.json(reponsePaginee(rows, total, pag));
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

    // Remet en stock chaque produit de la commande (et garde une trace dans l'historique)
    const [lignes] = await conn.query(
      'SELECT produit_id, quantite FROM lignes_commande WHERE commande_id = ? ORDER BY produit_id',
      [commande.id]
    );
    for (const l of lignes) {
      await conn.query('UPDATE produits SET stock = stock + ? WHERE id = ?', [l.quantite, l.produit_id]);
      await enregistrerMouvement(conn, {
        produit_id: l.produit_id,
        type: 'annulation',
        quantite: l.quantite,
        user_id: req.user.id,
        commande_id: commande.id,
        motif: `Annulation de la commande n°${commande.id}`,
      });
    }
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

// GET /api/commandes/:id/facture   (propriétaire ou admin) → PDF
exports.facture = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.nom AS client_nom, u.email AS client_email
       FROM commandes c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
      [req.params.id]
    );
    const commande = rows[0];
    if (!commande) {
      return res.status(404).json({ message: 'Commande introuvable' });
    }
    if (req.user.role !== 'admin' && commande.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    if (commande.statut === 'annulee') {
      return res.status(400).json({ message: "Pas de facture pour une commande annulée" });
    }

    const [lignes] = await pool.query(
      `SELECT p.nom AS produit_nom, l.quantite, l.prix_unitaire
       FROM lignes_commande l JOIN produits p ON p.id = l.produit_id
       WHERE l.commande_id = ? ORDER BY l.id`,
      [commande.id]
    );

    const numero = String(commande.id).padStart(5, '0');
    const dt = (n) => `${Number(n).toFixed(2)} DT`;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="facture-${numero}.pdf"`);
    doc.pipe(res);

    // En-tête
    doc.fontSize(22).fillColor('#2f5bea').text('Boutique', 50, 50);
    doc.fontSize(10).fillColor('#667085').text('Facture', 50, 78);
    doc.fontSize(20).fillColor('#1f2430').text(`FACTURE N° ${numero}`, 300, 50, { width: 245, align: 'right' });
    doc.fontSize(10).fillColor('#667085')
      .text(`Date : ${new Date(commande.date_commande).toLocaleDateString('fr-FR')}`, 300, 78, { width: 245, align: 'right' });

    // Client
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#e3e6ec').stroke();
    doc.fontSize(10).fillColor('#667085').text('FACTURÉ À', 50, 125);
    doc.fontSize(12).fillColor('#1f2430').text(commande.client_nom, 50, 140);
    doc.fontSize(10).fillColor('#667085').text(commande.client_email, 50, 157);

    // Tableau des lignes
    let y = 200;
    doc.rect(50, y, 495, 24).fill('#f5f6f8');
    doc.fillColor('#667085').fontSize(9);
    doc.text('PRODUIT', 58, y + 8);
    doc.text('QTÉ', 330, y + 8, { width: 40, align: 'right' });
    doc.text('PRIX UNIT.', 380, y + 8, { width: 75, align: 'right' });
    doc.text('SOUS-TOTAL', 460, y + 8, { width: 80, align: 'right' });
    y += 30;

    doc.fillColor('#1f2430').fontSize(10);
    for (const l of lignes) {
      if (y > 740) {
        doc.addPage();
        y = 50;
      }
      doc.text(l.produit_nom, 58, y, { width: 260 });
      doc.text(String(l.quantite), 330, y, { width: 40, align: 'right' });
      doc.text(dt(l.prix_unitaire), 380, y, { width: 75, align: 'right' });
      doc.text(dt(l.quantite * l.prix_unitaire), 460, y, { width: 80, align: 'right' });
      y += 22;
      doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#e3e6ec').stroke();
    }

    // Total
    y += 10;
    doc.fontSize(13).fillColor('#1f2430').text('TOTAL', 330, y, { width: 125, align: 'right' });
    doc.fontSize(13).fillColor('#2f5bea').text(dt(commande.total), 460, y, { width: 80, align: 'right' });

    doc.fontSize(9).fillColor('#667085')
      .text('Merci pour votre commande.', 50, y + 60, { width: 495, align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
};
