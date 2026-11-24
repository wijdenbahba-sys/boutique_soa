const express = require('express');
const { verifierToken, autoriser } = require('../middleware/auth');
const valider = require('../middleware/valider');
const schemas = require('../schemas');
const ctrl = require('../controllers/auditController');

const router = express.Router();
router.use(verifierToken, autoriser('admin'));
router.get('/', valider(schemas.filtresAudit, 'query'), ctrl.getAll);
module.exports = router;
