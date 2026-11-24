const crypto = require('crypto');
const pool = require('../config/db');
const { empreinte } = require('../middleware/cleApi');
const { journaliser } = require('../utils/audit');

const COLONNES = 'id, nom, prefixe, actif, nb_appels, derniere_utilisation, created_at';

// GET /api/cles-api   (admin) : jamais la clé elle-même, seulement son début
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${COLONNES} FROM api_keys ORDER BY id DESC`);
    res.json(rows.map((r) => ({ ...r, actif: Boolean(r.actif) })));
  } catch (err) { next(err); }
};

// POST /api/cles-api   body : { "nom": "Site partenaire" }   (admin)
// La clé complète n'est renvoyée QU'ICI, une seule fois : en base on ne garde que son empreinte SHA-256.
exports.create = async (req, res, next) => {
  try {
    const cle = `bk_live_${crypto.randomBytes(16).toString('hex')}`;
    const prefixe = cle.slice(0, 15);
    const [r] = await pool.query(
      'INSERT INTO api_keys (nom, prefixe, cle_hash, created_by) VALUES (?, ?, ?, ?)',
      [req.body.nom, prefixe, empreinte(cle), req.user.id]
    );
    await journaliser(req, { action: 'creer', entite: 'cle_api', entite_id: r.insertId, details: { nom: req.body.nom, prefixe } });
    res.status(201).json({ id: r.insertId, nom: req.body.nom, prefixe, cle, message: 'Copiez cette clé maintenant : elle ne sera plus affichée.' });
  } catch (err) { next(err); }
};

// PUT /api/cles-api/:id   body : { "actif": false }
exports.update = async (req, res, next) => {
  try {
    const [r] = await pool.query('UPDATE api_keys SET actif = ? WHERE id = ?', [req.body.actif ? 1 : 0, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Clé API introuvable' });
    await journaliser(req, { action: req.body.actif ? 'activer' : 'desactiver', entite: 'cle_api', entite_id: Number(req.params.id) });
    res.json({ id: Number(req.params.id), actif: Boolean(req.body.actif) });
  } catch (err) { next(err); }
};

// DELETE /api/cles-api/:id
exports.remove = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT nom FROM api_keys WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Clé API introuvable' });
    await pool.query('DELETE FROM api_keys WHERE id = ?', [req.params.id]);
    await journaliser(req, { action: 'supprimer', entite: 'cle_api', entite_id: Number(req.params.id), details: { nom: rows[0].nom } });
    res.json({ message: 'Clé API supprimée' });
  } catch (err) { next(err); }
};
