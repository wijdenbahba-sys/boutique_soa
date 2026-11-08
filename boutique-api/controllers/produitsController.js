const pool = require('../config/db');

// Vérifie les champs d'un produit ; retourne un message d'erreur ou null
function validerProduit({ nom, prix, stock, seuil_alerte }) {
  if (!nom) return 'Le nom est obligatoire';
  if (prix === undefined || isNaN(prix) || Number(prix) < 0) return 'Le prix doit être un nombre >= 0';
  if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
    return 'Le stock doit être un entier >= 0';
  }
  if (seuil_alerte !== undefined && (!Number.isInteger(Number(seuil_alerte)) || Number(seuil_alerte) < 0)) {
    return "Le seuil d'alerte doit être un entier >= 0";
  }
  return null;
}

// GET /api/produits?categorie=1&search=clavier
exports.getAll = async (req, res, next) => {
  try {
    const { categorie, search } = req.query;
    const conditions = [];
    const params = [];

    if (categorie) {
      conditions.push('p.category_id = ?');
      params.push(categorie);
    }
    if (search) {
      conditions.push('(p.nom LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT p.*, c.nom AS categorie_nom
       FROM produits p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.nom`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/produits/alertes  → produits dont le stock est <= au seuil d'alerte
exports.getAlertes = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.nom AS categorie_nom
       FROM produits p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.stock <= p.seuil_alerte
       ORDER BY p.stock ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/produits/:id
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.nom AS categorie_nom
       FROM produits p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/produits
exports.create = async (req, res, next) => {
  try {
    const erreur = validerProduit(req.body);
    if (erreur) {
      return res.status(400).json({ message: erreur });
    }

    const { nom, description, prix, stock = 0, seuil_alerte = 5, image_url, category_id } = req.body;

    const [result] = await pool.query(
      `INSERT INTO produits (nom, description, prix, stock, seuil_alerte, image_url, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nom, description || null, prix, stock, seuil_alerte, image_url || null, category_id || null]
    );

    res.status(201).json({ id: result.insertId, message: 'Produit créé' });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: "Cette catégorie n'existe pas" });
    }
    next(err);
  }
};

// PUT /api/produits/:id
exports.update = async (req, res, next) => {
  try {
    const erreur = validerProduit(req.body);
    if (erreur) {
      return res.status(400).json({ message: erreur });
    }

    const { nom, description, prix, stock = 0, seuil_alerte = 5, image_url, category_id } = req.body;

    const [result] = await pool.query(
      `UPDATE produits
       SET nom = ?, description = ?, prix = ?, stock = ?, seuil_alerte = ?, image_url = ?, category_id = ?
       WHERE id = ?`,
      [nom, description || null, prix, stock, seuil_alerte, image_url || null, category_id || null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    res.json({ message: 'Produit modifié' });
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: "Cette catégorie n'existe pas" });
    }
    next(err);
  }
};

// DELETE /api/produits/:id
exports.remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM produits WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    res.json({ message: 'Produit supprimé' });
  } catch (err) {
    // Le produit apparaît dans des commandes (ON DELETE RESTRICT)
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'Impossible de supprimer : ce produit figure dans des commandes',
      });
    }
    next(err);
  }
};

// PATCH /api/produits/:id/stock   body : { "ajustement": 10 }  ou  { "ajustement": -3 }
exports.ajusterStock = async (req, res, next) => {
  try {
    const ajustement = Number(req.body.ajustement);
    if (!Number.isInteger(ajustement) || ajustement === 0) {
      return res.status(400).json({ message: "ajustement doit être un entier différent de 0 (ex : 10 ou -3)" });
    }

    const [result] = await pool.query(
      'UPDATE produits SET stock = stock + ? WHERE id = ? AND stock + ? >= 0',
      [ajustement, req.params.id, ajustement]
    );

    if (result.affectedRows === 0) {
      const [rows] = await pool.query('SELECT id FROM produits WHERE id = ?', [req.params.id]);
      if (!rows[0]) {
        return res.status(404).json({ message: 'Produit introuvable' });
      }
      return res.status(400).json({ message: 'Le stock ne peut pas devenir négatif' });
    }

    const [rows] = await pool.query('SELECT id, nom, stock, seuil_alerte FROM produits WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};
