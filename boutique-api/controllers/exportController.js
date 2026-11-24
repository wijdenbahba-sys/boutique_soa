const pool = require('../config/db');
const { versCsv } = require('../utils/csv');

function envoyerCsv(res, nomFichier, colonnes, lignes) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  res.send(versCsv(colonnes, lignes));
}

const FORMAT_DATE = "'%Y-%m-%d %H:%i:%s'";

// GET /api/export/produits   (admin)
exports.produits = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.nom, p.description, c.nom AS categorie, p.prix, p.stock, p.seuil_alerte,
              (SELECT ROUND(AVG(a.note), 1) FROM avis a WHERE a.produit_id = p.id) AS note_moyenne
       FROM produits p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.id`
    );
    envoyerCsv(res, 'produits.csv', [
      { cle: 'id', titre: 'id' },
      { cle: 'nom', titre: 'nom' },
      { cle: 'description', titre: 'description' },
      { cle: 'prix', titre: 'prix' },
      { cle: 'stock', titre: 'stock' },
      { cle: 'seuil_alerte', titre: 'seuil_alerte' },
      { cle: 'categorie', titre: 'categorie' },
      { cle: 'note_moyenne', titre: 'note_moyenne' },
    ], rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/export/commandes   (admin)
exports.commandes = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, DATE_FORMAT(c.date_commande, ${FORMAT_DATE}) AS date, u.nom AS client, u.email,
              c.statut, c.code_promo, c.remise, c.total, c.adresse_livraison, c.ville, c.telephone
       FROM commandes c JOIN users u ON u.id = c.user_id
       ORDER BY c.id`
    );
    envoyerCsv(res, 'commandes.csv', [
      { cle: 'id', titre: 'id' },
      { cle: 'date', titre: 'date' },
      { cle: 'client', titre: 'client' },
      { cle: 'email', titre: 'email' },
      { cle: 'statut', titre: 'statut' },
      { cle: 'code_promo', titre: 'code_promo' },
      { cle: 'remise', titre: 'remise' },
      { cle: 'total', titre: 'total' },
      { cle: 'adresse_livraison', titre: 'adresse_livraison' },
      { cle: 'ville', titre: 'ville' },
      { cle: 'telephone', titre: 'telephone' },
    ], rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/export/mouvements   (admin)
exports.mouvements = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, DATE_FORMAT(m.created_at, ${FORMAT_DATE}) AS date, p.nom AS produit, m.type, m.quantite,
              m.stock_apres, m.motif, u.nom AS utilisateur
       FROM mouvements_stock m
       JOIN produits p ON p.id = m.produit_id
       LEFT JOIN users u ON u.id = m.user_id
       ORDER BY m.id`
    );
    envoyerCsv(res, 'mouvements.csv', [
      { cle: 'id', titre: 'id' },
      { cle: 'date', titre: 'date' },
      { cle: 'produit', titre: 'produit' },
      { cle: 'type', titre: 'type' },
      { cle: 'quantite', titre: 'quantite' },
      { cle: 'stock_apres', titre: 'stock_apres' },
      { cle: 'motif', titre: 'motif' },
      { cle: 'utilisateur', titre: 'utilisateur' },
    ], rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/export/audit   (admin) : mêmes filtres que /api/audit
exports.audit = async (req, res, next) => {
  try {
    const { construireFiltres } = require('./auditController');
    const f = construireFiltres(req.query);
    const [rows] = await pool.query(
      `SELECT id, DATE_FORMAT(created_at, ${FORMAT_DATE}) AS date, user_nom, action, entite, entite_id,
              CAST(details AS CHAR) AS details, ip
       FROM journal_audit ${f.sql} ORDER BY id`, f.params
    );
    envoyerCsv(res, 'audit.csv', ['id', 'date', 'user_nom', 'action', 'entite', 'entite_id', 'details', 'ip']
      .map((c) => ({ cle: c, titre: c })), rows);
  } catch (err) {
    next(err);
  }
};
