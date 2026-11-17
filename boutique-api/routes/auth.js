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

module.exports = router;
