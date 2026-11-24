const pool = require('../config/db');
const { enregistrerMouvement, ErreurHttp } = require('../utils/mouvements');
const { lirePagination, construireTri, reponsePaginee } = require('../utils/pagination');
const { detecterFormat, enregistrerImage, supprimerImage } = require('../utils/images');
const schemas = require('../schemas');
const { journaliser } = require('../utils/audit');
const { emettreStockBas } = require('../utils/stockBas');

// Colonnes d'un produit + catégorie + note moyenne des avis (réutilisé par la liste, le détail et les favoris)
const SELECT_PRODUIT = `SELECT p.*, c.nom AS categorie_nom,
         (SELECT ROUND(AVG(a.note), 1) FROM avis a WHERE a.produit_id = p.id) AS note_moyenne,
         (SELECT COUNT(*) FROM avis a WHERE a.produit_id = p.id) AS nb_avis
       FROM produits p
       LEFT JOIN categories c ON c.id = p.category_id`;
exports.SELECT_PRODUIT = SELECT_PRODUIT;

// Colonnes autorisées pour le tri (liste blanche)
const COLONNES_TRI = { nom: 'p.nom', prix: 'p.prix', stock: 'p.stock', date: 'p.created_at', note: 'note_moyenne' };

// GET /api/produits?categorie=1&search=clavier&alerte=true&prix_min=10&prix_max=100&en_stock=1&tri=prix&ordre=desc&page=1&limit=10
// Sans "page" ni "limit" : renvoie un simple tableau (compatible avec le frontend).
// Avec "page" ou "limit" : renvoie { data, pagination }.
exports.getAll = async (req, res, next) => {
  try {
    const { categorie, search, alerte, prix_min, prix_max, en_stock } = req.query;
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
    // Filtres de prix : on ignore silencieusement une valeur qui n'est pas un nombre
    if (prix_min !== undefined && prix_min !== '' && Number.isFinite(Number(prix_min))) {
      conditions.push('p.prix >= ?');
      params.push(Number(prix_min));
    }
    if (prix_max !== undefined && prix_max !== '' && Number.isFinite(Number(prix_max))) {
      conditions.push('p.prix <= ?');
      params.push(Number(prix_max));
    }
    if (en_stock === 'true' || en_stock === '1') {
      conditions.push('p.stock > 0');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const tri = construireTri(req.query, COLONNES_TRI, 'p.nom');
    const pag = lirePagination(req.query);

    const sql = `${SELECT_PRODUIT}
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
    const [rows] = await pool.query(`${SELECT_PRODUIT} WHERE p.stock <= p.seuil_alerte ORDER BY p.stock ASC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/produits/:id
exports.getOne = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${SELECT_PRODUIT} WHERE p.id = ?`, [req.params.id]);
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
    await journaliser(req, { action: 'creer', entite: 'produit', entite_id: result.insertId, details: { nom, prix, stock } });
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

    const [anciens] = await conn.query('SELECT stock, seuil_alerte, prix FROM produits WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!anciens[0]) {
      throw new ErreurHttp(404, 'Produit introuvable');
    }

    await conn.query(
      `UPDATE produits
       SET nom = ?, description = ?, prix = ?, stock = ?, seuil_alerte = ?, image_url = COALESCE(?, image_url), category_id = ?
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
    await journaliser(req, {
      action: 'modifier', entite: 'produit', entite_id: Number(req.params.id),
      details: { nom, avant: { prix: Number(anciens[0].prix), stock: anciens[0].stock }, apres: { prix, stock } },
    });
    await emettreStockBas([{ id: Number(req.params.id), stock: anciens[0].stock, seuil_alerte: anciens[0].seuil_alerte }]);
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
    const [existant] = await pool.query('SELECT image_url FROM produits WHERE id = ?', [req.params.id]);
    const [result] = await pool.query('DELETE FROM produits WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    supprimerImage(existant[0] && existant[0].image_url);
    await journaliser(req, { action: 'supprimer', entite: 'produit', entite_id: Number(req.params.id) });
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

    const [rows] = await conn.query('SELECT stock, seuil_alerte FROM produits WHERE id = ? FOR UPDATE', [req.params.id]);
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
    await journaliser(req, {
      action: 'ajuster_stock', entite: 'produit', entite_id: Number(req.params.id),
      details: { ajustement, motif, avant: rows[0].stock, apres: apres[0].stock },
    });
    await emettreStockBas([{ id: Number(req.params.id), stock: rows[0].stock, seuil_alerte: rows[0].seuil_alerte }]);
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

// POST /api/produits/:id/image   (admin) multipart/form-data, champ "image" (JPEG, PNG ou WebP, 2 Mo maximum)
// Le fichier est déjà dans req.file (middleware multer, en mémoire) : on vérifie son contenu réel puis on l'enregistre.
exports.envoyerImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucune image envoyée (champ "image" attendu)' });
    }
    const format = detecterFormat(req.file.buffer);
    if (!format) {
      return res.status(400).json({ message: 'Format non supporté : utilisez une image JPEG, PNG ou WebP' });
    }

    const [rows] = await pool.query('SELECT image_url FROM produits WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const imageUrl = enregistrerImage(req.file.buffer, format);
    await pool.query('UPDATE produits SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);
    supprimerImage(rows[0].image_url); // l'ancienne image ne sert plus

    res.json({ id: Number(req.params.id), image_url: imageUrl, message: 'Image enregistrée' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/produits/:id/image   (admin)
exports.supprimerImageProduit = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT image_url FROM produits WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    await pool.query('UPDATE produits SET image_url = NULL WHERE id = ?', [req.params.id]);
    supprimerImage(rows[0].image_url);
    res.json({ id: Number(req.params.id), image_url: null, message: 'Image supprimée' });
  } catch (err) {
    next(err);
  }
};

// POST /api/produits/import   (admin)
// body : { "produits": [ { "nom": "...", "prix": 12.5, "stock": 10, "seuil_alerte": 3, "categorie": "Maison" } ] }
// Les lignes invalides ou en doublon sont ignorées (et listées dans "erreurs"), les autres sont importées.
exports.importer = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const erreurs = [];
    let importes = 0;

    // Noms déjà présents en base (comparaison insensible à la casse, comme la base)
    const [existants] = await conn.query('SELECT nom FROM produits');
    const noms = new Set(existants.map((p) => p.nom.toLowerCase()));
    const categories = new Map(); // nom (minuscules) -> id

    for (let i = 0; i < req.body.produits.length; i++) {
      const numero = i + 1;
      const analyse = schemas.ligneImport.safeParse(req.body.produits[i] ?? {});
      if (!analyse.success) {
        erreurs.push({ ligne: numero, message: analyse.error.issues[0].message });
        continue;
      }
      const l = analyse.data;

      if (noms.has(l.nom.toLowerCase())) {
        erreurs.push({ ligne: numero, message: `Le produit "${l.nom}" existe déjà` });
        continue;
      }

      // Catégorie retrouvée par son nom, créée si elle n'existe pas
      let categoryId = null;
      if (l.categorie) {
        const cle = l.categorie.toLowerCase();
        if (!categories.has(cle)) {
          const [trouvees] = await conn.query('SELECT id FROM categories WHERE nom = ?', [l.categorie]);
          if (trouvees[0]) {
            categories.set(cle, trouvees[0].id);
          } else {
            const [cree] = await conn.query('INSERT INTO categories (nom) VALUES (?)', [l.categorie]);
            categories.set(cle, cree.insertId);
          }
        }
        categoryId = categories.get(cle);
      }

      const [result] = await conn.query(
        'INSERT INTO produits (nom, description, prix, stock, seuil_alerte, category_id) VALUES (?, ?, ?, ?, ?, ?)',
        [l.nom, l.description, l.prix, l.stock, l.seuil_alerte, categoryId]
      );
      if (l.stock > 0) {
        await enregistrerMouvement(conn, {
          produit_id: result.insertId, type: 'initial', quantite: l.stock, user_id: req.user.id, motif: 'Import CSV',
        });
      }
      noms.add(l.nom.toLowerCase());
      importes++;
    }

    await conn.commit();
    await journaliser(req, { action: 'importer', entite: 'produit', details: { importes, ignores: erreurs.length } });
    res.json({ importes, ignores: erreurs.length, erreurs });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
