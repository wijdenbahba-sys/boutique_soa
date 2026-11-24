const pool = require('../config/db');
const { journaliser } = require('../utils/audit');

// GET /api/fournisseurs
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fournisseurs ORDER BY nom');
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/fournisseurs/:id
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fournisseurs WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Fournisseur introuvable' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/fournisseurs
exports.create = async (req, res, next) => {
  try {
    const { nom, email, telephone, adresse } = req.body;
    const [result] = await pool.query(
      'INSERT INTO fournisseurs (nom, email, telephone, adresse) VALUES (?, ?, ?, ?)',
      [nom, email, telephone, adresse]
    );
    await journaliser(req, { action: 'creer', entite: 'fournisseur', entite_id: result.insertId, details: { nom } });
    res.status(201).json({ id: result.insertId, nom, email, telephone, adresse });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ce fournisseur existe déjà' });
    }
    next(err);
  }
};

// PUT /api/fournisseurs/:id
exports.update = async (req, res, next) => {
  try {
    const { nom, email, telephone, adresse } = req.body;
    const [result] = await pool.query(
      'UPDATE fournisseurs SET nom = ?, email = ?, telephone = ?, adresse = ? WHERE id = ?',
      [nom, email, telephone, adresse, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Fournisseur introuvable' });
    }
    await journaliser(req, { action: 'modifier', entite: 'fournisseur', entite_id: Number(req.params.id), details: { nom } });
    res.json({ id: Number(req.params.id), nom, email, telephone, adresse });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ce fournisseur existe déjà' });
    }
    next(err);
  }
};

// DELETE /api/fournisseurs/:id
exports.remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM fournisseurs WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Fournisseur introuvable' });
    }
    await journaliser(req, { action: 'supprimer', entite: 'fournisseur', entite_id: Number(req.params.id) });
    res.json({ message: 'Fournisseur supprimé' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Impossible de supprimer : ce fournisseur a des achats enregistrés' });
    }
    next(err);
  }
};
