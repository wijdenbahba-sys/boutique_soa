const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const { recevoirImage } = require('../middleware/upload');
const ctrl = require('../controllers/produitsController');
const avisCtrl = require('../controllers/avisController');

const router = express.Router();

router.get('/', ctrl.getAll);
// "alertes" doit être déclaré AVANT "/:id", sinon Express le prendrait pour un id
router.get('/alertes', verifierToken, autoriser('admin'), ctrl.getAlertes);
router.get('/:id', ctrl.getOne);
router.post('/', verifierToken, autoriser('admin'), valider(schemas.produit), ctrl.create);
// Import en masse : déclaré avant les routes "/:id/..."
router.post('/import', verifierToken, autoriser('admin'), valider(schemas.importProduits), ctrl.importer);
router.put('/:id', verifierToken, autoriser('admin'), valider(schemas.produit), ctrl.update);
router.delete('/:id', verifierToken, autoriser('admin'), ctrl.remove);
router.patch('/:id/stock', verifierToken, autoriser('admin'), valider(schemas.ajustementStock), ctrl.ajusterStock);


// Image du produit (multipart, champ "image")
router.post('/:id/image', verifierToken, autoriser('admin'), recevoirImage, ctrl.envoyerImage);
router.delete('/:id/image', verifierToken, autoriser('admin'), ctrl.supprimerImageProduit);

// Avis : lecture publique, écriture réservée aux clients qui ont acheté le produit
router.get('/:id/avis', avisCtrl.getParProduit);
router.post('/:id/avis', verifierToken, autoriser('client'), valider(schemas.avis), avisCtrl.donner);

module.exports = router;
