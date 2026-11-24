const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');

const api = () => request(app);

// Vide toutes les tables (dans le bon ordre pour les clés étrangères)
async function reinitialiser() {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['webhook_livraisons', 'webhooks', 'api_keys', 'journal_audit', 'emails', 'avis', 'favoris', 'codes_promo', 'achats_lignes', 'achats', 'fournisseurs', 'mouvements_stock', 'lignes_commande', 'commandes', 'produits', 'categories', 'users']) {
    await pool.query(`TRUNCATE TABLE ${t}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

// Crée un admin directement en base (l'inscription publique ne permet que le rôle client)
async function creerAdmin(email = 'admin@test.tn', motDePasse = 'admin123') {
  const hash = await bcrypt.hash(motDePasse, 4);
  await pool.query("INSERT INTO users (nom, email, mot_de_passe, role) VALUES ('Admin', ?, ?, 'admin')", [email, hash]);
  return connecter(email, motDePasse);
}

async function creerClient(email = 'client@test.tn', motDePasse = 'client123') {
  await api().post('/api/auth/register').send({ nom: 'Client Test', email, mot_de_passe: motDePasse });
  return connecter(email, motDePasse);
}

async function connecter(email, motDePasse) {
  const res = await api().post('/api/auth/login').send({ email, mot_de_passe: motDePasse });
  return { token: res.body.token, user: res.body.user };
}

const avec = (token) => ({ Authorization: `Bearer ${token}` });

async function creerProduit(tokenAdmin, surcharge = {}) {
  const res = await api()
    .post('/api/produits')
    .set(avec(tokenAdmin))
    .send({ nom: 'Produit test', prix: 10, stock: 20, seuil_alerte: 5, ...surcharge });
  return res.body.id;
}

async function fermer() {
  await pool.end();
}

module.exports = { api, pool, reinitialiser, creerAdmin, creerClient, connecter, avec, creerProduit, fermer };
