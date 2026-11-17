const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/statsController');

const router = express.Router();

router.use(verifierToken, autoriser('admin'));

router.get('/', ctrl.getStats);
router.get('/ventes', ctrl.getVentes);
router.get('/par-categorie', ctrl.getParCategorie);

module.exports = router;
