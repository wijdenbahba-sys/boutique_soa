const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/exportController');

const router = express.Router();

router.use(verifierToken, autoriser('admin'));

router.get('/produits', ctrl.produits);
router.get('/commandes', ctrl.commandes);
router.get('/mouvements', ctrl.mouvements);
router.get('/audit', ctrl.audit);

module.exports = router;
