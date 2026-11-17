const pool = require('../config/db');

// GET /api/stats   (admin)
exports.getStats = async (req, res, next) => {
  try {
    const [[produits]] = await pool.query('SELECT COUNT(*) AS total, COALESCE(SUM(prix * stock), 0) AS valeur_stock FROM produits');
    const [[alertes]] = await pool.query('SELECT COUNT(*) AS total FROM produits WHERE stock <= seuil_alerte');
    const [[commandes]] = await pool.query('SELECT COUNT(*) AS total FROM commandes');
    const [[ca]] = await pool.query("SELECT COALESCE(SUM(total), 0) AS total FROM commandes WHERE statut <> 'annulee'");
    const [[achats]] = await pool.query("SELECT COUNT(*) AS total FROM achats WHERE statut = 'commande'");

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
      valeur_stock: Number(produits.valeur_stock),
      produits_en_alerte: alertes.total,
      total_commandes: commandes.total,
      chiffre_affaires: Number(ca.total),
      achats_en_cours: achats.total,
      commandes_par_statut: parStatut,
      // SUM() peut revenir en texte selon le moteur (MySQL, MariaDB, TiDB) : on force un nombre
      top_produits: topProduits.map((t) => ({ ...t, quantite_vendue: Number(t.quantite_vendue) })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/ventes?jours=30   (admin)
// Une ligne par jour (les jours sans vente valent 0) : prêt pour un graphique.
exports.getVentes = async (req, res, next) => {
  try {
    const jours = Math.min(Math.max(parseInt(req.query.jours, 10) || 30, 1), 365);

    const [[{ aujourdhui }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS aujourdhui");
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(date_commande, '%Y-%m-%d') AS jour, COUNT(*) AS commandes, SUM(total) AS chiffre_affaires
       FROM commandes
       WHERE statut <> 'annulee' AND date_commande >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY jour`,
      [jours - 1]
    );
    const parJour = new Map(rows.map((r) => [r.jour, r]));

    // On génère tous les jours de la période pour ne laisser aucun trou dans le graphique
    const resultat = [];
    const fin = new Date(`${aujourdhui}T00:00:00Z`);
    for (let i = jours - 1; i >= 0; i--) {
      const d = new Date(fin);
      d.setUTCDate(d.getUTCDate() - i);
      const jour = d.toISOString().slice(0, 10);
      const r = parJour.get(jour);
      resultat.push({
        date: jour,
        commandes: r ? Number(r.commandes) : 0,
        chiffre_affaires: r ? Number(r.chiffre_affaires) : 0,
      });
    }
    res.json(resultat);
  } catch (err) {
    next(err);
  }
};

// GET /api/stats/par-categorie   (admin)
exports.getParCategorie = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(cat.nom, 'Sans catégorie') AS categorie,
              SUM(l.quantite) AS quantite_vendue,
              SUM(l.quantite * l.prix_unitaire) AS chiffre_affaires
       FROM lignes_commande l
       JOIN commandes c ON c.id = l.commande_id
       JOIN produits p ON p.id = l.produit_id
       LEFT JOIN categories cat ON cat.id = p.category_id
       WHERE c.statut <> 'annulee'
       GROUP BY cat.id, cat.nom
       ORDER BY chiffre_affaires DESC`
    );
    res.json(rows.map((r) => ({
      categorie: r.categorie,
      quantite_vendue: Number(r.quantite_vendue),
      chiffre_affaires: Number(r.chiffre_affaires),
    })));
  } catch (err) {
    next(err);
  }
};
