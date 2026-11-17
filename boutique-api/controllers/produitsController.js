const pool = require('../config/db');
const { enregistrerMouvement, ErreurHttp } = require('../utils/mouvements');
const { lirePagination, construireTri, reponsePaginee } = require('../utils/pagination');

// Colonnes autorisées pour le tri (liste blanche)
const COLONNES_TRI = { nom: 'p.nom', prix: 'p.prix', stock: 'p.stock', date: 'p.created_at' };

// GET /api/produits?categorie=1&search=clavier&alerte=true&tri=prix&ordre=desc&page=1&limit=10
// Sans "page" ni "limit" : renvoie un simple tableau (compatible avec le frontend).
// Avec "page" ou "limit" : renvoie { data, pagination }.
exports.getAll = async (req, res, next) => {
  try {
    const { categorie, search, alerte } = req.query;
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
    if (alerte === 'true' || alerte === '1') {
      conditions.push('p.stock <= p.seuil_alerte');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const tri = construireTri(req.query, COLONNES_TRI, 'p.nom');
    const pag = lirePagination(req.query);

    const sql = `SELECT p.*, c.nom AS categorie_nom
                 FROM produits p
                 LEFT JOIN categories c ON c.id = p.category_id
                 ${where}
                 ${tri.sql}`;

    if (!pag.pagine) {
      const [rows] = await pool.query(sql, params);
      return res.json(rows);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM produits p ${where}`, params);
    const [rows] = await pool.query(`${sql} LIMIT ? OFFSET ?`, [...params, pag.limit, pag.offset]);
    res.json(reponsePaginee(rows, total, pag));
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

// POST /api/produits   (le corps est déjà validé par le middleware valider(schemas.produit))
exports.create = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { nom, description, prix, stock, seuil_alerte, image_url, category_id } = req.body;
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO produits (nom, description, prix, stock, seuil_alerte, image_url, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nom, description, prix, stock, seuil_alerte, image_url, category_id]
    );

    if (stock > 0) {
      await enregistrerMouvement(conn, {
        produit_id: result.insertId, type: 'initial', quantite: stock, user_id: req.user.id, motif: 'Stock initial',
      });
    }

    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'Produit créé' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: "Cette catégorie n'existe pas" });
    }
    next(err);
  } finally {
    conn.release();
  }
};

// PUT /api/produits/:id
exports.update = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { nom, description, prix, stock, seuil_alerte, image_url, category_id } = req.body;
    await conn.beginTransaction();

    const [anciens] = await conn.query('SELECT stock FROM produits WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!anciens[0]) {
      throw new ErreurHttp(404, 'Produit introuvable');
    }

    await conn.query(
      `UPDATE produits
       SET nom = ?, description = ?, prix = ?, stock = ?, seuil_alerte = ?, image_url = ?, category_id = ?
       WHERE id = ?`,
      [nom, description, prix, stock, seuil_alerte, image_url, category_id, req.params.id]
    );

    // Si la fiche change le stock, on garde une trace dans l'historique
    if (stock !== anciens[0].stock) {
      await enregistrerMouvement(conn, {
        produit_id: Number(req.params.id),
        type: 'modification',
        quantite: stock - anciens[0].stock,
        user_id: req.user.id,
        motif: 'Modification de la fiche produit',
      });
    }

    await conn.commit();
    res.json({ message: 'Produit modifié' });
  } catch (err) {
    await conn.rollback();
    if (err instanceof ErreurHttp) {
      return res.status(err.status).json({ message: err.message });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: "Cette catégorie n'existe pas" });
    }
    next(err);
  } finally {
    conn.release();
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
    // Le produit apparaît dans des commandes ou des achats (ON DELETE RESTRICT)
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'Impossible de supprimer : ce produit figure dans des commandes ou des achats',
      });
    }
    next(err);
  }
};

// PATCH /api/produits/:id/stock   body : { "ajustement": 10, "motif": "Inventaire" }  ou  { "ajustement": -3 }
exports.ajusterStock = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { ajustement, motif } = req.body;
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT stock FROM produits WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows[0]) {
      throw new ErreurHttp(404, 'Produit introuvable');
    }
    if (rows[0].stock + ajustement < 0) {
      throw new ErreurHttp(400, 'Le stock ne peut pas devenir négatif');
    }

    await conn.query('UPDATE produits SET stock = stock + ? WHERE id = ?', [ajustement, req.params.id]);
    await enregistrerMouvement(conn, {
      produit_id: Number(req.params.id), type: 'ajustement', quantite: ajustement, user_id: req.user.id, motif,
    });

    const [apres] = await conn.query('SELECT id, nom, stock, seuil_alerte FROM produits WHERE id = ?', [req.params.id]);
    await conn.commit();
    res.json(apres[0]);
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
