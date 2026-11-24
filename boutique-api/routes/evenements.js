const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/evenementsController');

const router = express.Router();
router.use(verifierToken, autoriser('admin'));
router.get('/', ctrl.liste);
router.get('/flux', ctrl.flux);
module.exports = router;
