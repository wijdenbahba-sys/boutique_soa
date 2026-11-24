// Envoi des événements vers les URL des partenaires (webhooks) :
// signature HMAC-SHA256, délai maximal, nouvelles tentatives, journal de chaque tentative, protection SSRF.
const crypto = require('crypto');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { randomUUID } = require('crypto');
const pool = require('../config/db');

// ---- Protection SSRF : jamais d'appel vers le réseau interne, la boucle locale ou les métadonnées cloud ----
const interdits = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([a, n]) => interdits.addSubnet(a, n, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32]]
  .forEach(([a, n]) => interdits.addSubnet(a, n, 'ipv6'));

const privesAutorisees = () => process.env.WEBHOOK_ALLOW_PRIVATE === 'true';

function adresseInterdite(ip) {
  let adresse = ip;
  const mappee = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(adresse); // IPv6 qui cache une IPv4
  if (mappee) adresse = mappee[1];
  const famille = net.isIPv4(adresse) ? 'ipv4' : net.isIPv6(adresse) ? 'ipv6' : null;
  if (!famille) return true;
  return interdits.check(adresse, famille);
}

class ErreurUrl extends Error {}

// Résout le nom d'hôte et vérifie TOUTES les adresses (utilisé comme "lookup" de la connexion : pas de DNS rebinding)
function lookupSecurise(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, adresses) => {
    if (err) return callback(err);
    if (!privesAutorisees()) {
      const mauvaise = adresses.find((a) => adresseInterdite(a.address));
      if (mauvaise) return callback(new ErreurUrl('Adresse non autorisée (réseau privé ou local)'));
    }
    if (options && options.all) return callback(null, adresses);
    callback(null, adresses[0].address, adresses[0].family);
  });
}

// Vérification à la création d'un webhook : protocole http(s) puis adresse(s) du nom d'hôte
async function verifierUrl(texte) {
  let url;
  try {
    url = new URL(texte);
  } catch (e) {
    throw new ErreurUrl("L'URL n'est pas valide");
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErreurUrl('Seules les URL http et https sont autorisées');
  }
  if (privesAutorisees()) return url;
  const hote = url.hostname.replace(/^\[|\]$/g, '');
  const adresses = net.isIP(hote)
    ? [{ address: hote }]
    : await new Promise((resolve, reject) => dns.lookup(hote, { all: true }, (e, a) => (e ? reject(new ErreurUrl("Nom d'hôte introuvable")) : resolve(a))));
  if (adresses.some((a) => adresseInterdite(a.address))) {
    throw new ErreurUrl('URL non autorisée : les adresses privées, locales ou de métadonnées sont interdites');
  }
  return url;
}

// ---- Signature ----
function signer(corps, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(corps).digest('hex');
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// Un envoi HTTP : { statut_http, succes, reponse, duree_ms, erreur }
function envoyerUneFois(webhook, corps, entetes) {
  const delai = Number(process.env.WEBHOOK_TIMEOUT_MS) || 5000;
  return new Promise((resolve) => {
    const debut = Date.now();
    const fin = (r) => resolve({ duree_ms: Date.now() - debut, ...r });
    let url;
    try {
      url = new URL(webhook.url);
    } catch (e) {
      return fin({ statut_http: null, succes: false, reponse: null, erreur: 'URL invalide' });
    }
    const lib = url.protocol === 'https:' ? https : http;
    let termine = false;
    const req = lib.request(url, {
      method: 'POST',
      headers: { ...entetes, 'Content-Length': Buffer.byteLength(corps), 'User-Agent': 'Boutique-Webhooks/1.0' },
      lookup: lookupSecurise,
      timeout: delai,
      agent: false,
    }, (res) => {
      let recu = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (recu.length < 2000) recu += c; });
      res.on('end', () => {
        if (termine) return;
        termine = true;
        fin({ statut_http: res.statusCode, succes: res.statusCode >= 200 && res.statusCode < 300, reponse: recu.slice(0, 500), erreur: null });
      });
      res.on('error', () => {});
    });
    const echec = (message) => {
      if (termine) return;
      termine = true;
      fin({ statut_http: null, succes: false, reponse: message.slice(0, 500), erreur: message });
    };
    req.on('timeout', () => { req.destroy(); echec(`Délai dépassé (${delai} ms)`); });
    req.on('error', (e) => echec(e instanceof ErreurUrl ? e.message : (e.code || e.message || 'Erreur réseau')));
    req.write(corps);
    req.end();
  });
}

async function journaliserLivraison(webhookId, evenement, r, tentative) {
  try {
    await pool.query(
      `INSERT INTO webhook_livraisons (webhook_id, evenement, statut_http, succes, duree_ms, reponse, tentative)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [webhookId, evenement, r.statut_http, r.succes ? 1 : 0, r.duree_ms, r.reponse ? String(r.reponse).slice(0, 500) : null, tentative]
    );
  } catch (err) {
    // le webhook a peut-être été supprimé entre-temps : sans conséquence
  }
}

// Livre un événement (enveloppe {id,type,date,donnees}) à un webhook : 1 essai + 2 nouvelles tentatives
// en cas d'échec réseau ou de réponse 5xx. Chaque tentative est journalisée.
async function livrer(webhook, evenement, { tentativesMax = 3 } = {}) {
  const corps = JSON.stringify(evenement);
  const entetes = {
    'Content-Type': 'application/json',
    'X-Boutique-Event': evenement.type,
    'X-Boutique-Delivery': randomUUID(),
    'X-Boutique-Signature': signer(corps, webhook.secret),
  };
  const pause = Number(process.env.WEBHOOK_BACKOFF_MS ?? 500);
  let dernier;
  for (let tentative = 1; tentative <= tentativesMax; tentative++) {
    dernier = await envoyerUneFois(webhook, corps, entetes);
    await journaliserLivraison(webhook.id, evenement.type, dernier, tentative);
    if (dernier.succes) break;
    const retentable = dernier.statut_http === null || dernier.statut_http >= 500;
    if (!retentable || tentative === tentativesMax) break;
    await attendre(pause * tentative);
  }
  return dernier;
}

// Test synchrone (un seul essai) : POST /api/webhooks/:id/test
async function tester(webhook) {
  const evenement = { id: 0, type: 'test.ping', date: new Date().toISOString(), donnees: { message: 'Test de webhook Boutique' } };
  return livrer(webhook, evenement, { tentativesMax: 1 });
}

const correspond = (liste, type) => {
  const l = String(liste || '').split(',').map((e) => e.trim());
  return l.includes('*') || l.includes(type);
};

// Abonné du bus : envoie l'événement à chaque webhook actif concerné (sans jamais bloquer ni faire échouer l'appelant)
async function distribuer(evenement) {
  const [webhooks] = await pool.query('SELECT * FROM webhooks WHERE actif = 1');
  await Promise.all(
    webhooks.filter((w) => correspond(w.evenements, evenement.type)).map((w) => livrer(w, evenement).catch(() => {}))
  );
}

module.exports = { verifierUrl, ErreurUrl, adresseInterdite, signer, livrer, tester, distribuer, correspond };
