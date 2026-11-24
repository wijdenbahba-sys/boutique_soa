// Journal d'audit : qui a fait quoi, quand. journaliser() ne lance JAMAIS d'exception
// et ne stocke jamais de secret (mot de passe, token, clé, carte...).
const pool = require('../config/db');

const CLES_SENSIBLES = /^(ancien|nouveau|cle|cle_hash|numero|pan|iban|carte|cvc|cvv|expiration)$|password|passwd|secret|token|mot_?de_?passe|authorization|api_?key/i;

// Copie récursive de "details" en remplaçant les valeurs des champs sensibles
function nettoyer(valeur, profondeur = 0) {
  if (valeur === null || valeur === undefined) return valeur;
  if (profondeur > 4) return '[…]';
  if (Array.isArray(valeur)) return valeur.slice(0, 50).map((v) => nettoyer(v, profondeur + 1));
  if (typeof valeur === 'object') {
    const sortie = {};
    for (const [k, v] of Object.entries(valeur)) {
      sortie[k] = CLES_SENSIBLES.test(k) ? '[masqué]' : nettoyer(v, profondeur + 1);
    }
    return sortie;
  }
  if (typeof valeur === 'string') return valeur.length > 500 ? valeur.slice(0, 500) + '…' : valeur;
  return valeur;
}

// req peut être null (action système). L'utilisateur vient de req.user (JWT) ou de req.auditUser.
async function journaliser(req, { action, entite, entite_id = null, details = null }) {
  try {
    const acteur = (req && (req.auditUser || req.user)) || {};
    let nom = acteur.nom || null;
    if (!nom && acteur.id) {
      const [rows] = await pool.query('SELECT nom FROM users WHERE id = ?', [acteur.id]);
      nom = rows[0] ? rows[0].nom : null;
    }
    const ip = req ? (req.ip || (req.socket && req.socket.remoteAddress) || null) : null;
    await pool.query(
      `INSERT INTO journal_audit (user_id, user_nom, action, entite, entite_id, details, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        acteur.id || null, nom, action, entite, entite_id,
        details ? JSON.stringify(nettoyer(details)) : null,
        ip ? String(ip).slice(0, 64) : null,
      ]
    );
  } catch (err) {
    console.error('[audit] échec :', err && err.message);
  }
}

module.exports = { journaliser, nettoyer };
