const express = require('express');
const { verifierCleApi, limiteurParCle } = require('../middleware/cleApi');
const ctrl = require('../controllers/partenaireController');

// API publique pour les partenaires : authentification par clé (X-API-Key), lecture seule
const router = express.Router();
router.use(limiteurParCle, verifierCleApi);
router.get('/produits', ctrl.produits);
router.get('/produits/:id', ctrl.produit);
router.get('/stock', ctrl.stock);
module.exports = router;
