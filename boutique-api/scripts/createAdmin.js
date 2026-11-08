// Crée un compte administrateur.
// Usage : npm run create-admin -- "Nom" email@exemple.com motdepasse
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function main() {
  const [nom, email, motDePasse] = process.argv.slice(2);

  if (!nom || !email || !motDePasse) {
    console.log('Usage : npm run create-admin -- "Nom" email@exemple.com motdepasse');
    process.exit(1);
  }

  const hash = await bcrypt.hash(motDePasse, 10);

  try {
    await pool.query(
      'INSERT INTO users (nom, email, mot_de_passe, role) VALUES (?, ?, ?, ?)',
      [nom, email, hash, 'admin']
    );
    console.log(`Admin créé : ${email}`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error('Cet email existe déjà.');
    } else {
      console.error(err.message);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
