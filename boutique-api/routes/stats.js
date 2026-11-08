const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const ctrl = require('../controllers/statsController');

const router = express.Router();

router.get('/', verifierToken, autoriser('admin'), ctrl.getStats);

module.exports = router;
