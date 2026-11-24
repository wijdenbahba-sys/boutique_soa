const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/webhooksController');

const router = express.Router();
router.use(verifierToken, autoriser('admin'));
router.get('/', ctrl.getAll);
router.post('/', valider(schemas.webhook), ctrl.create);
router.put('/:id', valider(schemas.webhook), ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/test', ctrl.tester);
router.get('/:id/livraisons', ctrl.livraisons);
module.exports = router;
