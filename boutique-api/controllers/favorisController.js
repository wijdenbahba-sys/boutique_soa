const pool = require('../config/db');
const { SELECT_PRODUIT } = require('./produitsController');

// GET /api/favoris   (client) → les produits favoris, du plus récent au plus ancien
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${SELECT_PRODUIT}
       JOIN favoris f ON f.produit_id = p.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC, p.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/favoris/ids   (client) → [3, 7, 12] : sert à afficher les cœurs dans le catalogue
exports.getIds = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT produit_id FROM favoris WHERE user_id = ?', [req.user.id]);
    res.json(rows.map((r) => r.produit_id));
  } catch (err) {
    next(err);
  }
};

// POST /api/favoris/:produitId   (client) → 201 si ajouté, 200 s'il y était déjà (sans effet)
exports.ajouter = async (req, res, next) => {
  try {
    const [produit] = await pool.query('SELECT id FROM produits WHERE id = ?', [req.params.produitId]);
    if (!produit[0]) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    const [result] = await pool.query('INSERT IGNORE INTO favoris (user_id, produit_id) VALUES (?, ?)', [
      req.user.id,
      produit[0].id,
    ]);
    const cree = result.affectedRows === 1;
    res.status(cree ? 201 : 200).json({
      produit_id: produit[0].id,
      message: cree ? 'Ajouté aux favoris' : 'Déjà dans les favoris',
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/favoris/:produitId   (client)
exports.retirer = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM favoris WHERE user_id = ? AND produit_id = ?', [
      req.user.id,
      req.params.produitId,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Ce produit n'est pas dans vos favoris" });
    }
    res.json({ produit_id: Number(req.params.produitId), message: 'Retiré des favoris' });
  } catch (err) {
    next(err);
  }
};
