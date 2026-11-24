const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/favorisController');

const router = express.Router();

// Les favoris sont réservés aux clients connectés
router.use(verifierToken, autoriser('client'));

router.get('/', ctrl.getAll);
// "ids" doit être déclaré AVANT "/:produitId"
router.get('/ids', ctrl.getIds);
router.post('/:produitId', ctrl.ajouter);
router.delete('/:produitId', ctrl.retirer);

module.exports = router;
