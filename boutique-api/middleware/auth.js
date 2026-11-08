const jwt = require('jsonwebtoken');

// Vérifie le token JWT envoyé dans l'en-tête : Authorization: Bearer <token>
function verifierToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

// Autorise uniquement certains rôles : autoriser('admin'), autoriser('client', 'admin')
function autoriser(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    next();
  };
}

module.exports = { verifierToken, autoriser };
