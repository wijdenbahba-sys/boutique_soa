const pool = require('../config/db');
const { emettre } = require('./evenements');

// À appeler APRÈS le commit : anciens = [{ id, stock, seuil_alerte }] (état AVANT le changement).
// Émet "stock.bas" une seule fois par produit, au moment où le stock passe de "au-dessus du seuil" à "<= seuil".
async function emettreStockBas(anciens) {
  try {
    if (!anciens || !anciens.length) return;
    const ids = anciens.map((a) => a.id);
    const [rows] = await pool.query('SELECT id, nom, stock, seuil_alerte FROM produits WHERE id IN (?)', [ids]);
    for (const p of rows) {
      const avant = anciens.find((a) => a.id === p.id);
      if (avant && avant.stock > avant.seuil_alerte && p.stock <= p.seuil_alerte) {
        emettre('stock.bas', { produit_id: p.id, nom: p.nom, stock: p.stock, seuil_alerte: p.seuil_alerte });
      }
    }
  } catch (err) {
    // ne doit jamais faire échouer la requête
  }
}

module.exports = { emettreStockBas };
