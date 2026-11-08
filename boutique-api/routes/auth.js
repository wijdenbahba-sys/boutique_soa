const express = require('express');
const { verifierToken } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', verifierToken, ctrl.me);

module.exports = router;
