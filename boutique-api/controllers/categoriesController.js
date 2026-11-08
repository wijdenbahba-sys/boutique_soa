const pool = require('../config/db');

// GET /api/categories
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY nom');
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/categories/:id
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/categories
exports.create = async (req, res, next) => {
  try {
    const { nom, description } = req.body;
    if (!nom) {
      return res.status(400).json({ message: 'Le nom est obligatoire' });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (nom, description) VALUES (?, ?)',
      [nom, description || null]
    );
    res.status(201).json({ id: result.insertId, nom, description: description || null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cette catégorie existe déjà' });
    }
    next(err);
  }
};

// PUT /api/categories/:id
exports.update = async (req, res, next) => {
  try {
    const { nom, description } = req.body;
    if (!nom) {
      return res.status(400).json({ message: 'Le nom est obligatoire' });
    }

    const [result] = await pool.query(
      'UPDATE categories SET nom = ?, description = ? WHERE id = ?',
      [nom, description || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }
    res.json({ id: Number(req.params.id), nom, description: description || null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cette catégorie existe déjà' });
    }
    next(err);
  }
};

// DELETE /api/categories/:id
// (les produits de cette catégorie gardent leur existence, category_id passe à NULL)
exports.remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }
    res.json({ message: 'Catégorie supprimée' });
  } catch (err) {
    next(err);
  }
};
