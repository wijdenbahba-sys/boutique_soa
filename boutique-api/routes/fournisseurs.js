const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/fournisseursController');

const router = express.Router();

router.use(verifierToken, autoriser('admin'));

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', valider(schemas.fournisseur), ctrl.create);
router.put('/:id', valider(schemas.fournisseur), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
