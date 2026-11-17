require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./docs/swagger');
const { limiteGlobal } = require('./middleware/limiteurs');

const authRoutes = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const produitsRoutes = require('./routes/produits');
const commandesRoutes = require('./routes/commandes');
const statsRoutes = require('./routes/stats');
const mouvementsRoutes = require('./routes/mouvements');
const fournisseursRoutes = require('./routes/fournisseurs');
const achatsRoutes = require('./routes/achats');

const app = express();

// Derrière le proxy de Render/Vercel : nécessaire pour lire la vraie adresse IP (limitation de débit)
app.set('trust proxy', 1);

// En-têtes de sécurité HTTP (X-Content-Type-Options, HSTS, etc.)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS : en production, CORS_ORIGIN = adresse du frontend (plusieurs adresses séparées par des virgules)
const origines = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true; // sans configuration (développement) : toutes les origines
app.use(cors({ origin: origines }));

app.use(express.json({ limit: '100kb' }));
app.use(limiteGlobal);

app.get('/', (req, res) => {
  res.json({
    message: "API de gestion d'inventaire - Boutique en ligne",
    version: '2.0.0',
    documentation: '/api-docs',
  });
});

// Documentation interactive de l'API (Swagger UI) : /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Boutique API - Documentation',
  swaggerOptions: { persistAuthorization: true }, // garde le token après rechargement de la page
}));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/commandes', commandesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/mouvements', mouvementsRoutes);
app.use('/api/fournisseurs', fournisseursRoutes);
app.use('/api/achats', achatsRoutes);

// Route inconnue
app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corps de la requête invalide (JSON mal formé)' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Corps de la requête trop volumineux' });
  }
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

module.exports = app;
