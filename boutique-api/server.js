require('dotenv').config();

// Sans secret JWT, l'API ne peut pas signer de tokens : on s'arrête tout de suite avec un message clair
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET est manquant : copiez .env.example en .env et renseignez-le.');
  process.exit(1);
}

const app = require('./app');
const pool = require('./config/db');

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
