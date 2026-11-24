const crypto = require('crypto');
const pool = require('../config/db');
const { creerLimiteur } = require('./limiteurs');

// Empreinte SHA-256 d'une clé : seule l'empreinte est stockée en base
const empreinte = (cle) => crypto.createHash('sha256').update(String(cle)).digest('hex');

// Authentification des partenaires : en-tête  X-API-Key: bk_live_...
async function verifierCleApi(req, res, next) {
  const cle = req.headers['x-api-key'];
  if (!cle || typeof cle !== 'string') {
    return res.status(401).json({ message: 'Clé API manquante (en-tête X-API-Key)' });
  }
  try {
    const hash = empreinte(cle);
    const [rows] = await pool.query('SELECT id, nom, cle_hash, actif FROM api_keys WHERE cle_hash = ?', [hash]);
    const trouvee = rows[0];
    // Comparaison en temps constant (évite de deviner la clé en mesurant le temps de réponse)
    const valide = trouvee && crypto.timingSafeEqual(Buffer.from(trouvee.cle_hash, 'hex'), Buffer.from(hash, 'hex'));
    if (!valide || !trouvee.actif) {
      return res.status(401).json({ message: 'Clé API invalide ou désactivée' });
    }
    req.cleApi = { id: trouvee.id, nom: trouvee.nom };
    await pool.query('UPDATE api_keys SET nb_appels = nb_appels + 1, derniere_utilisation = NOW() WHERE id = ?', [trouvee.id]);
    next();
  } catch (err) {
    next(err);
  }
}

// 60 requêtes / minute / clé (à défaut de clé : par IP)
const limiteCleApi = creerLimiteur({
  windowMs: 60 * 1000,
  limit: Number(process.env.PARTENAIRE_LIMITE) || 60,
  message: 'Limite de requêtes de la clé API atteinte (60 par minute).',
});
const limiteurParCle = (req, res, next) => limiteCleApi(req, res, next);

module.exports = { verifierCleApi, limiteurParCle, empreinte };
