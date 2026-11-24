const crypto = require('crypto');
const pool = require('../config/db');
const service = require('../services/webhooks');
const { journaliser } = require('../utils/audit');

// Ne renvoie jamais le secret dans les listes
const publier = (w) => ({
  id: w.id, url: w.url, evenements: String(w.evenements).split(',').filter(Boolean),
  actif: Boolean(w.actif), created_at: w.created_at,
});

async function verifierUrlOuRepondre(url, res) {
  try {
    await service.verifierUrl(url);
    return true;
  } catch (err) {
    if (err instanceof service.ErreurUrl) {
      res.status(400).json({ message: err.message });
      return false;
    }
    throw err;
  }
}

// GET /api/webhooks
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.*, (SELECT COUNT(*) FROM webhook_livraisons l WHERE l.webhook_id = w.id) AS nb_envois,
              (SELECT l.succes FROM webhook_livraisons l WHERE l.webhook_id = w.id ORDER BY l.id DESC LIMIT 1) AS dernier_succes
       FROM webhooks w ORDER BY w.id DESC`
    );
    res.json(rows.map((w) => ({ ...publier(w), nb_envois: w.nb_envois, dernier_succes: w.dernier_succes === null ? null : Boolean(w.dernier_succes) })));
  } catch (err) { next(err); }
};

// POST /api/webhooks   body : { url, evenements: ["commande.creee"] | ["*"], actif? }
// Le secret (qui sert à vérifier la signature) n'est renvoyé qu'à la création.
exports.create = async (req, res, next) => {
  try {
    const { url, evenements, actif } = req.body;
    if (!(await verifierUrlOuRepondre(url, res))) return;
    const secret = crypto.randomBytes(32).toString('hex');
    const [r] = await pool.query('INSERT INTO webhooks (url, evenements, secret, actif) VALUES (?, ?, ?, ?)', [url, evenements.join(','), secret, actif ? 1 : 0]);
    await journaliser(req, { action: 'creer', entite: 'webhook', entite_id: r.insertId, details: { url, evenements } });
    res.status(201).json({ id: r.insertId, url, evenements, actif: Boolean(actif), secret, message: 'Conservez ce secret : il ne sera plus affiché.' });
  } catch (err) { next(err); }
};

// PUT /api/webhooks/:id
exports.update = async (req, res, next) => {
  try {
    const { url, evenements, actif } = req.body;
    if (!(await verifierUrlOuRepondre(url, res))) return;
    const [r] = await pool.query('UPDATE webhooks SET url = ?, evenements = ?, actif = ? WHERE id = ?', [url, evenements.join(','), actif ? 1 : 0, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ message: 'Webhook introuvable' });
    await journaliser(req, { action: 'modifier', entite: 'webhook', entite_id: Number(req.params.id), details: { url, evenements, actif } });
    res.json({ id: Number(req.params.id), url, evenements, actif: Boolean(actif) });
  } catch (err) { next(err); }
};

// DELETE /api/webhooks/:id
exports.remove = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT url FROM webhooks WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Webhook introuvable' });
    await pool.query('DELETE FROM webhooks WHERE id = ?', [req.params.id]);
    await journaliser(req, { action: 'supprimer', entite: 'webhook', entite_id: Number(req.params.id), details: { url: rows[0].url } });
    res.json({ message: 'Webhook supprimé' });
  } catch (err) { next(err); }
};

// POST /api/webhooks/:id/test : envoie un événement "test.ping" et renvoie le résultat
exports.tester = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM webhooks WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Webhook introuvable' });
    const r = await service.tester(rows[0]);
    res.json({ succes: Boolean(r.succes), statut_http: r.statut_http ?? null, duree_ms: r.duree_ms ?? null, reponse: r.reponse ?? r.erreur ?? null });
  } catch (err) { next(err); }
};

// GET /api/webhooks/:id/livraisons : les 50 derniers envois
exports.livraisons = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id FROM webhooks WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Webhook introuvable' });
    const [l] = await pool.query('SELECT * FROM webhook_livraisons WHERE webhook_id = ? ORDER BY id DESC LIMIT 50', [req.params.id]);
    res.json(l.map((x) => ({ ...x, succes: Boolean(x.succes) })));
  } catch (err) { next(err); }
};
