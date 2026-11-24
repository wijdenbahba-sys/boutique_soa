const pool = require('../config/db');
const { journaliser } = require('../utils/audit');
const { emettre } = require('../utils/evenements');

// GET /api/produits/:id/avis   (public)
exports.getParProduit = async (req, res, next) => {
  try {
    const [produit] = await pool.query('SELECT id FROM produits WHERE id = ?', [req.params.id]);
    if (!produit[0]) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const [avis] = await pool.query(
      `SELECT a.id, a.note, a.commentaire, a.created_at, a.user_id, u.nom AS auteur
       FROM avis a JOIN users u ON u.id = a.user_id
       WHERE a.produit_id = ?
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 200`,
      [req.params.id]
    );

    const [parNote] = await pool.query(
      'SELECT note, COUNT(*) AS nombre FROM avis WHERE produit_id = ? GROUP BY note',
      [req.params.id]
    );
    const repartition = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let somme = 0;
    for (const r of parNote) {
      repartition[r.note] = Number(r.nombre);
      total += Number(r.nombre);
      somme += r.note * Number(r.nombre);
    }

    res.json({
      moyenne: total ? Math.round((somme / total) * 10) / 10 : null,
      total,
      repartition,
      avis,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/produits/:id/avis   (client) body : { "note": 4, "commentaire": "Très bien" }
// Réservé aux clients qui ont acheté le produit (commande non annulée). Un second envoi modifie l'avis existant.
exports.donner = async (req, res, next) => {
  try {
    const [produit] = await pool.query('SELECT id, nom FROM produits WHERE id = ?', [req.params.id]);
    if (!produit[0]) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const [achats] = await pool.query(
      `SELECT 1 FROM lignes_commande l JOIN commandes c ON c.id = l.commande_id
       WHERE c.user_id = ? AND l.produit_id = ? AND c.statut <> 'annulee' LIMIT 1`,
      [req.user.id, produit[0].id]
    );
    if (!achats[0]) {
      return res.status(403).json({ message: 'Achat requis : vous ne pouvez noter que les produits que vous avez commandés' });
    }

    const { note, commentaire } = req.body;
    const [existant] = await pool.query('SELECT id FROM avis WHERE produit_id = ? AND user_id = ?', [produit[0].id, req.user.id]);

    let id;
    if (existant[0]) {
      id = existant[0].id;
      await pool.query('UPDATE avis SET note = ?, commentaire = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?', [note, commentaire, id]);
    } else {
      const [result] = await pool.query('INSERT INTO avis (produit_id, user_id, note, commentaire) VALUES (?, ?, ?, ?)', [
        produit[0].id, req.user.id, note, commentaire,
      ]);
      id = result.insertId;
    }

    if (!existant[0]) emettre('avis.cree', { id, produit_id: produit[0].id, nom: produit[0].nom, note });
    res.status(existant[0] ? 200 : 201).json({
      id, produit_id: produit[0].id, note, commentaire,
      message: existant[0] ? 'Avis modifié' : 'Avis enregistré',
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/avis/:id   (auteur de l'avis ou admin)
exports.supprimer = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, user_id FROM avis WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ message: 'Avis introuvable' });
    }
    if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    await pool.query('DELETE FROM avis WHERE id = ?', [rows[0].id]);
    if (req.user.role === 'admin') await journaliser(req, { action: 'supprimer', entite: 'avis', entite_id: rows[0].id });
    res.json({ message: 'Avis supprimé' });
  } catch (err) {
    next(err);
  }
};
