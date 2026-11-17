// Enregistre une ligne dans l'historique du stock.
// À appeler APRÈS la mise à jour du stock, avec la même connexion (donc dans la même transaction).
async function enregistrerMouvement(conn, { produit_id, type, quantite, user_id = null, commande_id = null, achat_id = null, motif = null }) {
  const [[produit]] = await conn.query('SELECT stock FROM produits WHERE id = ?', [produit_id]);
  await conn.query(
    `INSERT INTO mouvements_stock (produit_id, type, quantite, stock_apres, user_id, commande_id, achat_id, motif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [produit_id, type, quantite, produit.stock, user_id, commande_id, achat_id, motif]
  );
}

// Erreur "métier" : permet de renvoyer un code HTTP précis depuis une transaction
class ErreurHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { enregistrerMouvement, ErreurHttp };
