const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/commandesController');

const router = express.Router();

// Toutes les routes de commandes demandent d'être connecté
router.use(verifierToken);

router.post('/', autoriser('client'), ctrl.creer);
// "mes-commandes" doit être déclaré AVANT "/:id"
router.get('/mes-commandes', autoriser('client'), ctrl.mesCommandes);
router.get('/', autoriser('admin'), ctrl.getAll);
router.get('/:id', ctrl.getOne); // le contrôle propriétaire / admin est fait dans le controller
router.patch('/:id/statut', autoriser('admin'), ctrl.changerStatut);
router.patch('/:id/annuler', ctrl.annuler); // propriétaire ou admin, contrôlé dans le controller

module.exports = router;
