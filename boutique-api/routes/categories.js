const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/categoriesController');

const router = express.Router();

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', verifierToken, autoriser('admin'), ctrl.create);
router.put('/:id', verifierToken, autoriser('admin'), ctrl.update);
router.delete('/:id', verifierToken, autoriser('admin'), ctrl.remove);

module.exports = router;
