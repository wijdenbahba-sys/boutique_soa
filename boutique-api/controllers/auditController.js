const pool = require('../config/db');
const { lirePagination, reponsePaginee } = require('../utils/pagination');

// Construit le WHERE à partir des filtres (toutes les valeurs passent en paramètres : pas d'injection SQL)
function construireFiltres(q) {
  const where = [];
  const params = [];
  if (q.entite) { where.push('entite = ?'); params.push(q.entite); }
  if (q.action) { where.push('action = ?'); params.push(q.action); }
  if (q.user_id) { where.push('user_id = ?'); params.push(q.user_id); }
  if (q.du) { where.push('created_at >= ?'); params.push(`${q.du} 00:00:00`); }
  if (q.au) { where.push('created_at <= ?'); params.push(`${q.au} 23:59:59`); }
  if (q.search) {
    where.push('(user_nom LIKE ? OR action LIKE ? OR entite LIKE ? OR CAST(details AS CHAR) LIKE ?)');
    const m = `%${q.search}%`;
    params.push(m, m, m, m);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// GET /api/audit?entite=&action=&user_id=&du=&au=&search=&page=&limit=   (admin)
exports.getAll = async (req, res, next) => {
  try {
    const f = construireFiltres(req.query);
    const pag = lirePagination(req.query, { forcer: true, limiteParDefaut: 20 });
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM journal_audit ${f.sql}`, f.params);
    const [rows] = await pool.query(
      `SELECT id, user_id, user_nom, action, entite, entite_id, details, ip, created_at
       FROM journal_audit ${f.sql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...f.params, pag.limit, pag.offset]
    );
    res.json(reponsePaginee(rows, total, pag));
  } catch (err) { next(err); }
};

exports.construireFiltres = construireFiltres;
