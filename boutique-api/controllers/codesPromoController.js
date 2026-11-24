const pool = require('../config/db');
const { calculerRemise } = require('../utils/promo');
const { ErreurHttp } = require('../utils/mouvements');
const { journaliser } = require('../utils/audit');

const COLONNES = `id, code, type, valeur, min_commande,
  DATE_FORMAT(date_expiration, '%Y-%m-%d') AS date_expiration,
  utilisations_max, utilisations, actif,
  (date_expiration IS NOT NULL AND date_expiration < CURDATE()) AS expire`;

const versObjet = (r) => ({ ...r, actif: !!r.actif, expire: !!r.expire });

// GET /api/codes-promo   (admin)
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${COLONNES} FROM codes_promo ORDER BY id DESC`);
    res.json(rows.map(versObjet));
  } catch (err) {
    next(err);
  }
};

// POST /api/codes-promo   (admin)
exports.create = async (req, res, next) => {
  try {
    const c = req.body;
    const [result] = await pool.query(
      `INSERT INTO codes_promo (code, type, valeur, min_commande, date_expiration, utilisations_max, actif)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.code, c.type, c.valeur, c.min_commande, c.date_expiration, c.utilisations_max, c.actif ? 1 : 0]
    );
    await journaliser(req, { action: 'creer', entite: 'code_promo', entite_id: result.insertId, details: { code: req.body.code, type: req.body.type, valeur: req.body.valeur } });
    res.status(201).json({ id: result.insertId, message: 'Code promo créé' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ce code promo existe déjà' });
    }
    next(err);
  }
};

// PUT /api/codes-promo/:id   (admin) — le compteur d'utilisations n'est pas modifiable
exports.update = async (req, res, next) => {
  try {
    const c = req.body;
    const [result] = await pool.query(
      `UPDATE codes_promo
       SET code = ?, type = ?, valeur = ?, min_commande = ?, date_expiration = ?, utilisations_max = ?, actif = ?
       WHERE id = ?`,
      [c.code, c.type, c.valeur, c.min_commande, c.date_expiration, c.utilisations_max, c.actif ? 1 : 0, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Code promo introuvable' });
    }
    await journaliser(req, { action: 'modifier', entite: 'code_promo', entite_id: Number(req.params.id), details: { code: req.body.code, actif: req.body.actif } });
    res.json({ message: 'Code promo modifié' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ce code promo existe déjà' });
    }
    next(err);
  }
};

// DELETE /api/codes-promo/:id   (admin)
exports.remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM codes_promo WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Code promo introuvable' });
    }
    await journaliser(req, { action: 'supprimer', entite: 'code_promo', entite_id: Number(req.params.id) });
    res.json({ message: 'Code promo supprimé' });
  } catch (err) {
    next(err);
  }
};

// POST /api/codes-promo/verifier   (utilisateur connecté)  body : { "code": "BIENVENUE10", "montant": 120 }
// Simple vérification pour afficher la réduction dans le panier. La commande recalcule tout côté serveur.
exports.verifier = async (req, res, next) => {
  try {
    const resultat = await calculerRemise(pool, req.body.code, req.body.montant);
    res.json(resultat);
  } catch (err) {
    if (err instanceof ErreurHttp) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
};
