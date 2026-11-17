const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/commandesController');

const router = express.Router();

// Toutes les routes de commandes demandent d'être connecté
router.use(verifierToken);

router.post('/', autoriser('client'), valider(schemas.commande), ctrl.creer);
// "mes-commandes" doit être déclaré AVANT "/:id"
router.get('/mes-commandes', autoriser('client'), ctrl.mesCommandes);
router.get('/', autoriser('admin'), ctrl.getAll);
router.get('/:id', ctrl.getOne); // le contrôle propriétaire / admin est fait dans le controller
router.get('/:id/facture', ctrl.facture); // PDF, propriétaire ou admin
router.patch('/:id/statut', autoriser('admin'), valider(schemas.statutCommande), ctrl.changerStatut);
router.patch('/:id/annuler', ctrl.annuler); // propriétaire ou admin, contrôlé dans le controller

module.exports = router;
