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
const favorisRoutes = require('./routes/favoris');
const avisRoutes = require('./routes/avis');
const codesPromoRoutes = require('./routes/codesPromo');
const exportRoutes = require('./routes/export');
const evenementsRoutes = require('./routes/evenements');
const clesApiRoutes = require('./routes/clesApi');
const partenaireRoutes = require('./routes/partenaire');
const webhooksRoutes = require('./routes/webhooks');
const auditRoutes = require('./routes/audit');
const emailsRoutes = require('./routes/emails');
const { dossierUploads } = require('./utils/images');

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

// Images des produits : servies avant la limitation de débit (une page de catalogue en charge des dizaines)
app.use('/uploads', express.static(dossierUploads(), { maxAge: '7d', index: false, dotfiles: 'ignore' }));

// L'import en masse de produits (jusqu'à 500 lignes) a droit à un corps plus gros que le reste de l'API.
// body-parser ignore ensuite la requête (déjà lue) dans le parseur global ci-dessous.
app.use('/api/produits/import', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(limiteGlobal);

app.get('/', (req, res) => {
  res.json({
    message: "API de gestion d'inventaire - Boutique en ligne",
    version: '4.0.0',
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
app.use('/api/favoris', favorisRoutes);
app.use('/api/avis', avisRoutes);
app.use('/api/codes-promo', codesPromoRoutes);
app.use('/api/export', exportRoutes);
require('./services/abonnes').demarrer();
app.use('/api/evenements', evenementsRoutes);
app.use('/api/cles-api', clesApiRoutes);
app.use('/api/partenaire', partenaireRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/emails', emailsRoutes);

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
