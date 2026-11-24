const http = require('http');
const crypto = require('crypto');
const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');
const { derniers } = require('../../utils/evenements');
const { signer } = require('../../services/webhooks');

let admin; let client; let pid;
let recepteur; let recus; let portRecepteur; let codeReponse;

beforeAll(async () => {
  process.env.WEBHOOK_ALLOW_PRIVATE = 'true';
  recus = [];
  codeReponse = 200;
  recepteur = http.createServer((req, res) => {
    let corps = '';
    req.on('data', (d) => { corps += d; });
    req.on('end', () => {
      recus.push({ corps, entetes: req.headers });
      res.statusCode = codeReponse;
      res.end('ok');
    });
  });
  await new Promise((r) => recepteur.listen(0, '127.0.0.1', r));
  portRecepteur = recepteur.address().port;
});
afterAll(async () => {
  delete process.env.WEBHOOK_ALLOW_PRIVATE;
  await new Promise((r) => recepteur.close(r));
  await fermer();
});
beforeEach(async () => {
  await reinitialiser();
  recus.length = 0;
  codeReponse = 200;
  admin = await creerAdmin();
  client = await creerClient();
  pid = await creerProduit(admin.token, { prix: 20, stock: 10, seuil_alerte: 5 });
});

const attendre = async (cond, ms = 3000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 25)); }
  return false;
};
const commander = (q = 1) => api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: pid, quantite: q }] });

describe('Clés API + API partenaire', () => {
  test('sans clé : 401 ; clé inconnue : 401 ; client/anonyme ne gère pas les clés', async () => {
    expect((await api().get('/api/partenaire/produits')).status).toBe(401);
    expect((await api().get('/api/partenaire/produits').set('X-API-Key', 'bk_live_nimporte')).status).toBe(401);
    expect((await api().post('/api/cles-api').send({ nom: 'x' })).status).toBe(401);
    expect((await api().post('/api/cles-api').set(avec(client.token)).send({ nom: 'x' })).status).toBe(403);
  });

  test('création : clé affichée une seule fois, seule l\'empreinte SHA-256 est en base', async () => {
    const c = await api().post('/api/cles-api').set(avec(admin.token)).send({ nom: 'Partenaire A' });
    expect(c.status).toBe(201);
    expect(c.body.cle).toMatch(/^bk_live_[0-9a-f]{32}$/);
    const [[ligne]] = await pool.query('SELECT * FROM api_keys WHERE id = ?', [c.body.id]);
    expect(JSON.stringify(ligne)).not.toContain(c.body.cle);
    expect(ligne.cle_hash).toBe(crypto.createHash('sha256').update(c.body.cle).digest('hex'));
    const liste = await api().get('/api/cles-api').set(avec(admin.token));
    expect(JSON.stringify(liste.body)).not.toContain(c.body.cle);
    expect(liste.body[0].prefixe).toBe(c.body.cle.slice(0, 15));
  });

  test('la clé donne accès en lecture seule, compte les appels, et peut être désactivée', async () => {
    const { body } = await api().post('/api/cles-api').set(avec(admin.token)).send({ nom: 'P' });
    const r = await api().get('/api/partenaire/produits').set('X-API-Key', body.cle);
    expect(r.status).toBe(200);
    expect(r.body.data[0]).toHaveProperty('nom');
    expect(r.body.data[0]).not.toHaveProperty('seuil_alerte');
    expect((await api().get(`/api/partenaire/produits/${pid}`).set('X-API-Key', body.cle)).status).toBe(200);
    expect((await api().get('/api/partenaire/stock').set('X-API-Key', body.cle)).body[0].stock).toBe(10);
    expect((await api().post('/api/produits').set('X-API-Key', body.cle).send({ nom: 'x', prix: 1 })).status).toBe(401);
    const liste = await api().get('/api/cles-api').set(avec(admin.token));
    expect(liste.body[0].nb_appels).toBe(3);
    await api().put(`/api/cles-api/${body.id}`).set(avec(admin.token)).send({ actif: false });
    expect((await api().get('/api/partenaire/stock').set('X-API-Key', body.cle)).status).toBe(401);
    expect((await api().delete(`/api/cles-api/${body.id}`).set(avec(admin.token))).status).toBe(200);
    expect((await api().delete(`/api/cles-api/${body.id}`).set(avec(admin.token))).status).toBe(404);
  });
});

describe('Événements du domaine', () => {
  test('commande → commande.creee ; stock bas émis une seule fois au franchissement du seuil', async () => {
    await commander(1);
    expect(derniers().some((e) => e.type === 'commande.creee' && e.donnees.total === 20)).toBe(true);
    expect(derniers().some((e) => e.type === 'stock.bas')).toBe(false);
    await commander(4); // 10 -> 5 : franchit le seuil
    await commander(1); // déjà bas : pas de nouvel événement
    const bas = derniers().filter((e) => e.type === 'stock.bas' && e.donnees.produit_id === pid);
    expect(bas).toHaveLength(1);
    expect(bas[0].donnees.stock).toBe(5);
  });

  test('liste des événements réservée à l\'admin', async () => {
    await commander(1);
    expect((await api().get('/api/evenements').set(avec(client.token))).status).toBe(403);
    const r = await api().get('/api/evenements').set(avec(admin.token));
    expect(r.status).toBe(200);
    expect(r.body[0]).toHaveProperty('type');
  });

  test('flux SSE : refuse sans token et pousse les nouveaux événements', async () => {
    expect((await api().get('/api/evenements/flux')).status).toBe(401);
    const app = require('../../app');
    const serveur = app.listen(0, '127.0.0.1');
    await new Promise((r) => serveur.once('listening', r));
    const port = serveur.address().port;
    const recu = await new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, agent: false, path: '/api/evenements/flux', headers: avec(admin.token) }, (res) => {
        let tampon = '';
        res.on('data', (d) => {
          tampon += d;
          if (tampon.includes('event: commande.creee')) { req.destroy(); resolve(tampon); }
        });
        // supertest n'envoie la requête que si on l'attend (await)
        setTimeout(async () => { await commander(1); }, 100);
      });
      req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
      setTimeout(() => reject(new Error('timeout SSE')), 4000);
    });
    expect(recu).toMatch(/data: \{"id":\d+,"type":"commande.creee"/);
    await new Promise((r) => serveur.close(r));
  });
});

describe('Webhooks', () => {
  const creer = (corps) => api().post('/api/webhooks').set(avec(admin.token))
    .send({ url: `http://127.0.0.1:${portRecepteur}/hook`, evenements: ['commande.creee'], ...corps });

  test('SSRF : réseaux privés refusés par défaut, schémas non http refusés', async () => {
    process.env.WEBHOOK_ALLOW_PRIVATE = 'false';
    try {
      for (const url of ['http://127.0.0.1/x', 'http://localhost/x', 'http://169.254.169.254/latest', 'http://10.0.0.5/x', 'http://[::1]/x']) {
        expect((await creer({ url })).status).toBe(400);
      }
    } finally { process.env.WEBHOOK_ALLOW_PRIVATE = 'true'; }
    expect((await creer({ url: 'ftp://exemple.tn/x' })).status).toBe(400);
    expect((await creer({ evenements: ['nimporte.quoi'] })).status).toBe(400);
  });

  test('livraison signée HMAC-SHA256 : le récepteur peut vérifier la signature', async () => {
    const w = await creer({});
    expect(w.status).toBe(201);
    await commander(1);
    expect(await attendre(() => recus.length >= 1)).toBe(true);
    const { corps, entetes } = recus[0];
    expect(entetes['x-boutique-event']).toBe('commande.creee');
    expect(entetes['x-boutique-signature']).toBe(signer(corps, w.body.secret));
    expect(entetes['x-boutique-signature']).not.toBe(signer(corps, 'mauvais-secret'));
    expect(JSON.parse(corps).type).toBe('commande.creee');
  });

  test('le secret n\'apparaît pas dans les listes ; événements non abonnés non envoyés', async () => {
    const w = await creer({ evenements: ['avis.cree'] });
    const liste = await api().get('/api/webhooks').set(avec(admin.token));
    expect(JSON.stringify(liste.body)).not.toContain(w.body.secret);
    await commander(1);
    await new Promise((r) => setTimeout(r, 200));
    expect(recus).toHaveLength(0);
  });

  test('échec 500 : 3 tentatives journalisées', async () => {
    codeReponse = 500;
    const w = await creer({});
    await commander(1);
    expect(await attendre(() => recus.length >= 3)).toBe(true);
    await attendre(async () => (await pool.query('SELECT COUNT(*) AS n FROM webhook_livraisons'))[0][0].n >= 3);
    const l = await api().get(`/api/webhooks/${w.body.id}/livraisons`).set(avec(admin.token));
    expect(l.body.length).toBe(3);
    expect(l.body.every((x) => x.succes === false && x.statut_http === 500)).toBe(true);
  });

  test('erreur 4xx : pas de nouvelle tentative ; test ping ; webhook inactif ignoré', async () => {
    codeReponse = 404;
    const w = await creer({});
    const t = await api().post(`/api/webhooks/${w.body.id}/test`).set(avec(admin.token));
    expect(t.body).toMatchObject({ succes: false, statut_http: 404 });
    expect(recus).toHaveLength(1);
    expect(recus[0].entetes['x-boutique-event']).toBe('test.ping');
    await api().put(`/api/webhooks/${w.body.id}`).set(avec(admin.token)).send({ url: `http://127.0.0.1:${portRecepteur}/hook`, evenements: ['*'], actif: false });
    recus.length = 0;
    await commander(1);
    await new Promise((r) => setTimeout(r, 200));
    expect(recus).toHaveLength(0);
  });

  test('un récepteur injoignable ne fait pas échouer la commande', async () => {
    await api().post('/api/webhooks').set(avec(admin.token)).send({ url: 'http://127.0.0.1:1/x', evenements: ['*'] });
    expect((await commander(1)).status).toBe(201);
  });
});

describe('Journal d\'audit', () => {
  test('actions admin journalisées ; réservé à l\'admin', async () => {
    const c = await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Mode' });
    await api().put(`/api/produits/${pid}`).set(avec(admin.token)).send({ nom: 'Produit test', prix: 25, stock: 10, seuil_alerte: 5 });
    expect((await api().get('/api/audit').set(avec(client.token))).status).toBe(403);
    expect((await api().get('/api/audit')).status).toBe(401);
    const r = await api().get('/api/audit?entite=produit').set(avec(admin.token));
    expect(r.status).toBe(200);
    const modif = r.body.data.find((a) => a.action === 'modifier');
    expect(modif.user_nom).toBe('Admin');
    expect(modif.details.avant.prix).toBe(20);
    expect(modif.details.apres.prix).toBe(25);
    const cat = await api().get('/api/audit?entite=categorie').set(avec(admin.token));
    expect(cat.body.data[0].entite_id).toBe(c.body.id);
    expect(r.body.pagination).toHaveProperty('total');
  });

  test('connexion échouée journalisée, jamais le mot de passe ; clés sensibles masquées', async () => {
    await api().post('/api/auth/login').send({ email: 'admin@test.tn', mot_de_passe: 'SecretFaux123' });
    await api().post('/api/auth/login').send({ email: 'admin@test.tn', mot_de_passe: 'admin123' });
    await api().put('/api/auth/mot-de-passe').set(avec(admin.token)).send({ ancien: 'admin123', nouveau: 'NouveauSecret456' });
    const r = await api().get('/api/audit').set(avec(admin.token));
    const brut = JSON.stringify(r.body);
    expect(brut).not.toContain('SecretFaux123');
    expect(brut).not.toContain('NouveauSecret456');
    expect(r.body.data.some((a) => a.action === 'connexion_echec')).toBe(true);
    expect(r.body.data.some((a) => a.action === 'connexion' && a.user_nom === 'Admin')).toBe(true);
    const { nettoyer } = require('../../utils/audit');
    expect(JSON.stringify(nettoyer({ numero: '4242', cvc: '123', mot_de_passe: 'x', nom: 'ok' }))).not.toMatch(/4242|123|"x"/);
  });

  test('filtres (action, dates, recherche) et export CSV', async () => {
    await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Mode' });
    const aujourd = new Date().toISOString().slice(0, 10);
    expect((await api().get(`/api/audit?action=creer&du=${aujourd}&au=${aujourd}`).set(avec(admin.token))).body.data.length).toBeGreaterThan(0);
    expect((await api().get('/api/audit?action=inexistante').set(avec(admin.token))).body.data).toHaveLength(0);
    expect((await api().get('/api/audit?du=pas-une-date').set(avec(admin.token))).status).toBe(400);
    expect((await api().get("/api/audit?search=%27%3B%20DROP%20TABLE%20users%3B--").set(avec(admin.token))).status).toBe(200);
    const csv = await api().get('/api/export/audit').set(avec(admin.token));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toMatch(/csv/);
    expect(csv.text).toContain('categorie');
    expect((await api().get('/api/export/audit').set(avec(client.token))).status).toBe(403);
  });
});

describe('Emails (mode simulation)', () => {
  test('commande → email de confirmation enregistré, HTML échappé, renvoi possible', async () => {
    await pool.query("UPDATE users SET nom = '<script>alert(1)</script>' WHERE id = ?", [client.user.id]);
    await commander(1);
    expect(await attendre(async () => (await pool.query('SELECT COUNT(*) AS n FROM emails'))[0][0].n >= 1)).toBe(true);
    const liste = await api().get('/api/emails').set(avec(admin.token));
    expect(liste.body.mode).toBe('simulation');
    const mail = liste.body.data[0];
    expect(mail).toMatchObject({ destinataire: 'client@test.tn', type: 'commande_confirmation', statut: 'simule' });
    expect(mail).not.toHaveProperty('corps_html');
    const un = await api().get(`/api/emails/${mail.id}`).set(avec(admin.token));
    expect(un.body.corps_html).not.toContain('<script>');
    expect(un.body.corps_html).toContain('&lt;script&gt;');
    expect((await api().post(`/api/emails/${mail.id}/renvoyer`).set(avec(admin.token))).status).toBe(200);
    expect((await api().get('/api/emails/99999').set(avec(admin.token))).status).toBe(404);
    expect((await api().get('/api/emails').set(avec(client.token))).status).toBe(403);
  });

  test('changement de statut et annulation envoient un email', async () => {
    const c = await commander(1);
    await api().patch(`/api/commandes/${c.body.id}/statut`).set(avec(admin.token)).send({ statut: 'confirmee' });
    await api().patch(`/api/commandes/${c.body.id}/annuler`).set(avec(admin.token));
    await attendre(async () => (await pool.query('SELECT COUNT(*) AS n FROM emails'))[0][0].n >= 3);
    const [rows] = await pool.query('SELECT type FROM emails');
    expect(rows.map((r) => r.type)).toEqual(expect.arrayContaining(['commande_confirmation', 'commande_statut', 'commande_annulation']));
  });
});
