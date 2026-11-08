require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const produitsRoutes = require('./routes/produits');
const commandesRoutes = require('./routes/commandes');
const statsRoutes = require('./routes/stats');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: "API de gestion d'inventaire - Boutique en ligne",
    version: '1.0.0',
    documentation: '/api-docs',
  });
});

// Documentation interactive de l'API (Swagger UI) : http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Boutique API - Documentation',
  swaggerOptions: { persistAuthorization: true }, // garde le token après rechargement de la page
}));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/commandes', commandesRoutes);
app.use('/api/stats', statsRoutes);

// Route inconnue
app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  try {
    await pool.query('SELECT 1');
    console.log('Connexion MySQL OK');
  } catch (err) {
    console.error('Connexion MySQL impossible :', err.message);
  }
});
