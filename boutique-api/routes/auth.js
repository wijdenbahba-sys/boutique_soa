const express = require('express');
const { verifierToken } = require('../middleware/auth');
const valider = require('../middleware/valider');
const { limiteLogin, limiteInscription } = require('../middleware/limiteurs');
const schemas = require('../schemas');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post('/register', limiteInscription, valider(schemas.register), ctrl.register);
router.post('/login', limiteLogin, valider(schemas.login), ctrl.login);
router.get('/me', verifierToken, ctrl.me);
router.put('/profil', verifierToken, valider(schemas.profil), ctrl.modifierProfil);
// limiteLogin : seuls les échecs comptent, ça bloque la devinette de l'ancien mot de passe avec un token volé
router.put('/mot-de-passe', verifierToken, limiteLogin, valider(schemas.motDePasse), ctrl.changerMotDePasse);

module.exports = router;
