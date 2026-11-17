const pool = require('../config/db');
const { lirePagination, reponsePaginee } = require('../utils/pagination');

// GET /api/mouvements?produit_id=1&type=vente&du=2026-11-01&au=2026-11-30&page=1&limit=20   (admin)
// Toujours paginé : { data, pagination }
exports.getAll = async (req, res, next) => {
  try {
    const { produit_id, type, du, au } = req.query;
    const conditions = [];
    const params = [];

    if (produit_id) {
      conditions.push('m.produit_id = ?');
      params.push(produit_id);
    }
    if (type) {
      conditions.push('m.type = ?');
      params.push(type);
    }
    if (du) {
      conditions.push('m.created_at >= ?');
      params.push(`${du} 00:00:00`);
    }
    if (au) {
      conditions.push('m.created_at <= ?');
      params.push(`${au} 23:59:59`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const pag = lirePagination(req.query, { limiteParDefaut: 20, forcer: true });

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM mouvements_stock m ${where}`, params);
    const [rows] = await pool.query(
      `SELECT m.id, m.produit_id, p.nom AS produit_nom, m.type, m.quantite, m.stock_apres,
              m.user_id, u.nom AS utilisateur_nom, m.commande_id, m.achat_id, m.motif, m.created_at
       FROM mouvements_stock m
       JOIN produits p ON p.id = m.produit_id
       LEFT JOIN users u ON u.id = m.user_id
       ${where}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pag.limit, pag.offset]
    );
    res.json(reponsePaginee(rows, total, pag));
  } catch (err) {
    next(err);
  }
};
