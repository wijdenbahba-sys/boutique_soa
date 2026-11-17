// Exécuté une seule fois avant tous les tests : (re)crée la base de test à partir de schema.sql
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

module.exports = async () => {
  const nomBase = process.env.TEST_DB_NAME || 'boutique_test';
  const schema = fs
    .readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8')
    .replace(/boutique_db/g, nomBase); // on redirige tout le script vers la base de test

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  await conn.query(schema);
  await conn.end();
};
