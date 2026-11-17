const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/mouvementsController');

const router = express.Router();

router.get('/', verifierToken, autoriser('admin'), ctrl.getAll);

module.exports = router;
