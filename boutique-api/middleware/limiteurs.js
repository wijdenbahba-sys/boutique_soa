const rateLimit = require('express-rate-limit');

// Fabrique un limiteur : au-delà de "limit" requêtes par fenêtre, l'API répond 429.
function creerLimiteur({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7', // renvoie les en-têtes RateLimit-* pour informer le client
    legacyHeaders: false,
    message: { message },
    // Pendant les tests automatiques on désactive la limitation (sauf si on la teste explicitement)
    skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT,
  });
}

// 300 requêtes / 15 min / IP sur toute l'API
const limiteGlobal = creerLimiteur({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: 'Trop de requêtes, réessayez dans quelques minutes.',
});

// Protection contre la force brute : 10 échecs de connexion / 15 min / IP
// (les connexions réussies ne comptent pas)
const limiteLogin = creerLimiteur({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Trop de tentatives de connexion, réessayez dans 15 minutes.',
});

// 20 créations de compte / heure / IP
const limiteInscription = creerLimiteur({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: "Trop de créations de compte depuis cette adresse, réessayez plus tard.",
});

module.exports = { creerLimiteur, limiteGlobal, limiteLogin, limiteInscription };
