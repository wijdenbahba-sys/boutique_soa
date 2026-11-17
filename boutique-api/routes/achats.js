const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/achatsController');

const router = express.Router();

router.use(verifierToken, autoriser('admin'));

router.get('/', ctrl.getAll);
// "suggestions" doit être déclaré AVANT "/:id"
router.get('/suggestions', ctrl.suggestions);
router.get('/:id', ctrl.getOne);
router.post('/', valider(schemas.achat), ctrl.creer);
router.patch('/:id/recevoir', ctrl.recevoir);
router.patch('/:id/annuler', ctrl.annuler);

module.exports = router;
