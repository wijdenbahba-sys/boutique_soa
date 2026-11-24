const express = require('express');
const { verifierToken } = require('../middleware/auth');
const ctrl = require('../controllers/avisController');

const router = express.Router();

// Les avis sont créés et lus via /api/produits/:id/avis ; ici seulement la suppression d'un avis précis
router.delete('/:id', verifierToken, ctrl.supprimer);

module.exports = router;
