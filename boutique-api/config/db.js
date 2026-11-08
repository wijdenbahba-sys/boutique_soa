const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions MySQL partagé par toute l'application
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'boutique_db',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, // retourne les DECIMAL (prix, total) comme des nombres
});

module.exports = pool;
