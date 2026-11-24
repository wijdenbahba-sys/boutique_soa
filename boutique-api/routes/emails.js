const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/emailsController');

const router = express.Router();
router.use(verifierToken, autoriser('admin'));
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/:id/renvoyer', ctrl.renvoyer);
module.exports = router;
