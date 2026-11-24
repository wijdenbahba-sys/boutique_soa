const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/clesApiController');

const router = express.Router();
router.use(verifierToken, autoriser('admin'));
router.get('/', ctrl.getAll);
router.post('/', valider(schemas.cleApi), ctrl.create);
router.put('/:id', valider(schemas.cleApiMaj), ctrl.update);
router.delete('/:id', ctrl.remove);
module.exports = router;
