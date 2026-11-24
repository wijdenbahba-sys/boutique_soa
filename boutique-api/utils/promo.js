const { ErreurHttp } = require('./mouvements');

const arrondi = (n) => Math.round(n * 100) / 100;

// Vérifie un code promo pour un montant donné et calcule la remise.
// "conn" peut être le pool ou une connexion de transaction ; avec verrou = true on utilise
// FOR UPDATE (obligatoire lors d'une commande : deux clients ne doivent pas utiliser la dernière utilisation).
// Lance une ErreurHttp 400 avec un message précis si le code n'est pas utilisable.
async function calculerRemise(conn, code, montant, { verrou = false } = {}) {
  const [rows] = await conn.query(
    `SELECT *, (date_expiration IS NOT NULL AND date_expiration < CURDATE()) AS expire
     FROM codes_promo WHERE code = ? ${verrou ? 'FOR UPDATE' : ''}`,
    [code]
  );
  const promo = rows[0];

  if (!promo) throw new ErreurHttp(400, 'Code promo inconnu');
  if (!promo.actif) throw new ErreurHttp(400, "Ce code promo n'est plus actif");
  if (promo.expire) throw new ErreurHttp(400, 'Ce code promo a expiré');
  if (promo.utilisations_max !== null && promo.utilisations >= promo.utilisations_max) {
    throw new ErreurHttp(400, "Ce code promo n'est plus disponible (nombre d'utilisations atteint)");
  }
  if (montant < promo.min_commande) {
    throw new ErreurHttp(400, `Ce code promo exige une commande d'au moins ${Number(promo.min_commande).toFixed(2)} DT`);
  }

  const brute = promo.type === 'pourcentage' ? (montant * promo.valeur) / 100 : promo.valeur;
  const remise = arrondi(Math.min(brute, montant)); // jamais plus que le montant de la commande

  return {
    code: promo.code,
    type: promo.type,
    valeur: promo.valeur,
    remise,
    total_apres: arrondi(montant - remise),
  };
}

module.exports = { calculerRemise, arrondi };
