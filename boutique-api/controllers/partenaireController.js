const pool = require('../config/db');
const { lirePagination, reponsePaginee } = require('../utils/pagination');

// Champs exposés aux partenaires (volontairement plus restreints que l'API interne)
const SELECT = `p.id, p.nom, p.description, p.prix, p.stock, p.image_url, c.nom AS categorie_nom,
  (SELECT ROUND(AVG(a.note), 1) FROM avis a WHERE a.produit_id = p.id) AS note_moyenne,
  (SELECT COUNT(*) FROM avis a WHERE a.produit_id = p.id) AS nb_avis`;

// GET /api/partenaire/produits?search=&categorie=&page=&limit=
exports.produits = async (req, res, next) => {
  try {
    const params = [];
    const filtres = [];
    if (req.query.search) {
      filtres.push('(p.nom LIKE ? OR p.description LIKE ?)');
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }
    if (req.query.categorie) {
      filtres.push('p.category_id = ?');
      params.push(Number(req.query.categorie) || 0);
    }
    const where = filtres.length ? `WHERE ${filtres.join(' AND ')}` : '';
    const pag = lirePagination(req.query, { forcer: true, limiteParDefaut: 20 });
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM produits p ${where}`, params);
    const [rows] = await pool.query(
      `SELECT ${SELECT} FROM produits p LEFT JOIN categories c ON c.id = p.category_id ${where} ORDER BY p.nom LIMIT ? OFFSET ?`,
      [...params, pag.limit, pag.offset]
    );
    res.json(reponsePaginee(rows, total, pag));
  } catch (err) { next(err); }
};

// GET /api/partenaire/produits/:id
exports.produit = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SELECT} FROM produits p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`, [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Produit introuvable' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// GET /api/partenaire/stock : niveaux de stock (pour synchroniser un autre site)
exports.stock = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, stock FROM produits ORDER BY id');
    res.json(rows);
  } catch (err) { next(err); }
};
