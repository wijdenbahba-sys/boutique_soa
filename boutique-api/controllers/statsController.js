const pool = require('../config/db');

// GET /api/stats   (admin)
exports.getStats = async (req, res, next) => {
  try {
    const [[produits]] = await pool.query('SELECT COUNT(*) AS total FROM produits');
    const [[alertes]] = await pool.query('SELECT COUNT(*) AS total FROM produits WHERE stock <= seuil_alerte');
    const [[commandes]] = await pool.query('SELECT COUNT(*) AS total FROM commandes');
    const [[ca]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total FROM commandes WHERE statut <> 'annulee'");

    const [parStatut] = await pool.query('SELECT statut, COUNT(*) AS nombre FROM commandes GROUP BY statut');

    const [topProduits] = await pool.query(
      `SELECT p.id, p.nom, SUM(l.quantite) AS quantite_vendue
       FROM lignes_commande l
       JOIN commandes c ON c.id = l.commande_id
       JOIN produits p ON p.id = l.produit_id
       WHERE c.statut <> 'annulee'
       GROUP BY p.id, p.nom
       ORDER BY quantite_vendue DESC
       LIMIT 5`
    );

    res.json({
      total_produits: produits.total,
      produits_en_alerte: alertes.total,
      total_commandes: commandes.total,
      chiffre_affaires: Number(ca.total),
      commandes_par_statut: parStatut,
      top_produits: topProduits,
    });
  } catch (err) {
    next(err);
  }
};
