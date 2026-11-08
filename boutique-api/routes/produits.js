const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/produitsController');

const router = express.Router();

router.get('/', ctrl.getAll);
// "alertes" doit être déclaré AVANT "/:id", sinon Express le prendrait pour un id
router.get('/alertes', verifierToken, autoriser('admin'), ctrl.getAlertes);
router.get('/:id', ctrl.getOne);
router.post('/', verifierToken, autoriser('admin'), ctrl.create);
router.put('/:id', verifierToken, autoriser('admin'), ctrl.update);
router.delete('/:id', verifierToken, autoriser('admin'), ctrl.remove);
router.patch('/:id/stock', verifierToken, autoriser('admin'), ctrl.ajusterStock);

module.exports = router;
