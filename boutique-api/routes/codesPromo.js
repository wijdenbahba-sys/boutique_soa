const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/codesPromoController');

const router = express.Router();

router.use(verifierToken);

// Vérification d'un code dans le panier : tout utilisateur connecté
router.post('/verifier', valider(schemas.verifierPromo), ctrl.verifier);

// Gestion des codes : admin
router.get('/', autoriser('admin'), ctrl.getAll);
router.post('/', autoriser('admin'), valider(schemas.codePromo), ctrl.create);
router.put('/:id', autoriser('admin'), valider(schemas.codePromo), ctrl.update);
router.delete('/:id', autoriser('admin'), ctrl.remove);

module.exports = router;
