const pool = require('../config/db');
const email = require('../services/email');
const { lirePagination, reponsePaginee } = require('../utils/pagination');
const { journaliser } = require('../utils/audit');

// GET /api/emails?page=&limit=   (admin) : boîte d'envoi (sans le corps HTML, qui est lourd)
exports.getAll = async (req, res, next) => {
  try {
    const pag = lirePagination(req.query, { forcer: true, limiteParDefaut: 20 });
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM emails');
    const [rows] = await pool.query(
      'SELECT id, destinataire, sujet, type, commande_id, statut, erreur, created_at FROM emails ORDER BY id DESC LIMIT ? OFFSET ?',
      [pag.limit, pag.offset]
    );
    res.json({ ...reponsePaginee(rows, total, pag), mode: email.modeSimulation() ? 'simulation' : 'smtp' });
  } catch (err) { next(err); }
};

// GET /api/emails/:id : un email avec son contenu HTML (aperçu)
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM emails WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Email introuvable' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// POST /api/emails/:id/renvoyer
exports.renvoyer = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM emails WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Email introuvable' });
    await email.renvoyer(rows[0]);
    await journaliser(req, { action: 'renvoyer', entite: 'email', entite_id: rows[0].id, details: { destinataire: rows[0].destinataire } });
    res.json({ message: 'Email renvoyé' });
  } catch (err) { next(err); }
};
