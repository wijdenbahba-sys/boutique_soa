const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;
let autre;
let produit; // 50 DT

const commander = (token, extra = {}, quantite = 1) =>
  api().post('/api/commandes').set(avec(token)).send({ produits: [{ produit_id: produit, quantite }], ...extra });
const creerCode = (corps) => api().post('/api/codes-promo').set(avec(admin.token)).send(corps);
const utilisations = async (code) => (await pool.query('SELECT utilisations FROM codes_promo WHERE code = ?', [code]))[0][0].utilisations;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient('c1@test.tn');
  autre = await creerClient('c2@test.tn');
  produit = await creerProduit(admin.token, { nom: 'Clavier', prix: 50, stock: 100 });
});
afterAll(fermer);

describe('CRUD des codes promo (admin)', () => {
  test('401 sans token, 403 pour un client', async () => {
    expect((await api().get('/api/codes-promo')).status).toBe(401);
    expect((await api().get('/api/codes-promo').set(avec(client.token))).status).toBe(403);
    expect((await api().post('/api/codes-promo').set(avec(client.token)).send({})).status).toBe(403);
    expect((await api().put('/api/codes-promo/1').set(avec(client.token)).send({})).status).toBe(403);
    expect((await api().delete('/api/codes-promo/1').set(avec(client.token))).status).toBe(403);
  });

  test('400 : code invalide, type inconnu, valeur ≤ 0, pourcentage > 100, date mal formée', async () => {
    const ok = { code: 'TEST', type: 'montant', valeur: 5 };
    for (const mauvais of [
      { ...ok, code: '' }, { ...ok, code: 'avec espace' }, { ...ok, type: 'gratuit' }, { ...ok, valeur: 0 },
      { ...ok, valeur: -3 }, { code: 'P', type: 'pourcentage', valeur: 150 }, { ...ok, date_expiration: '12/12/2030' },
      { ...ok, utilisations_max: 0 },
    ]) {
      expect((await creerCode(mauvais)).status).toBe(400);
    }
  });

  test('création (code mis en majuscules), liste, doublon 409, modification, suppression, 404', async () => {
    const cree = await creerCode({ code: 'promo-ete', type: 'pourcentage', valeur: 20, min_commande: 10, date_expiration: '2099-12-31', utilisations_max: 5 });
    expect(cree.status).toBe(201);
    expect((await creerCode({ code: 'PROMO-ETE', type: 'montant', valeur: 5 })).status).toBe(409);

    const liste = await api().get('/api/codes-promo').set(avec(admin.token));
    const code = liste.body.find((c) => c.code === 'PROMO-ETE');
    expect(code).toMatchObject({ type: 'pourcentage', valeur: 20, min_commande: 10, date_expiration: '2099-12-31', utilisations_max: 5, utilisations: 0, actif: true, expire: false });

    const modif = await api().put(`/api/codes-promo/${cree.body.id}`).set(avec(admin.token))
      .send({ code: 'PROMO-ETE', type: 'montant', valeur: 7, actif: false });
    expect(modif.status).toBe(200);
    expect((await api().get('/api/codes-promo').set(avec(admin.token))).body.find((c) => c.id === cree.body.id))
      .toMatchObject({ type: 'montant', valeur: 7, actif: false, date_expiration: null, utilisations_max: null });

    expect((await api().put('/api/codes-promo/99999').set(avec(admin.token)).send({ code: 'X', type: 'montant', valeur: 1 })).status).toBe(404);
    expect((await api().delete(`/api/codes-promo/${cree.body.id}`).set(avec(admin.token))).status).toBe(200);
    expect((await api().delete(`/api/codes-promo/${cree.body.id}`).set(avec(admin.token))).status).toBe(404);
  });
});

describe('POST /api/codes-promo/verifier', () => {
  beforeAll(async () => {
    await creerCode({ code: 'DIX', type: 'pourcentage', valeur: 10 });
    await creerCode({ code: 'CINQ', type: 'montant', valeur: 5, min_commande: 30 });
    await creerCode({ code: 'GROS', type: 'montant', valeur: 500 });
    await creerCode({ code: 'OFF', type: 'montant', valeur: 5, actif: false });
    await creerCode({ code: 'PERIME', type: 'montant', valeur: 5 });
    await pool.query("UPDATE codes_promo SET date_expiration = '2020-01-01' WHERE code = 'PERIME'");
    await creerCode({ code: 'UNIQUE1', type: 'montant', valeur: 5, utilisations_max: 1 });
    await pool.query("UPDATE codes_promo SET utilisations = 1 WHERE code = 'UNIQUE1'");
  });

  const verifier = (token, corps) => api().post('/api/codes-promo/verifier').set(avec(token)).send(corps);

  test('401 sans token ; 400 si le corps est incomplet', async () => {
    expect((await api().post('/api/codes-promo/verifier').send({ code: 'DIX', montant: 100 })).status).toBe(401);
    expect((await verifier(client.token, { montant: 100 })).status).toBe(400);
    expect((await verifier(client.token, { code: 'DIX' })).status).toBe(400);
  });

  test('pourcentage, montant fixe, insensible à la casse, utilisable aussi par un admin', async () => {
    expect((await verifier(client.token, { code: 'dix', montant: 120 })).body).toEqual({ code: 'DIX', type: 'pourcentage', valeur: 10, remise: 12, total_apres: 108 });
    expect((await verifier(client.token, { code: 'CINQ', montant: 40 })).body).toMatchObject({ remise: 5, total_apres: 35 });
    expect((await verifier(admin.token, { code: 'CINQ', montant: 40 })).status).toBe(200);
  });

  test('la remise ne dépasse jamais le montant', async () => {
    expect((await verifier(client.token, { code: 'GROS', montant: 20 })).body).toMatchObject({ remise: 20, total_apres: 0 });
  });

  test('400 avec un message précis : inconnu, désactivé, expiré, épuisé, minimum non atteint', async () => {
    const cas = [
      ['INEXISTANT', 100, /inconnu/i],
      ['OFF', 100, /plus actif/i],
      ['PERIME', 100, /expiré/i],
      ['UNIQUE1', 100, /utilisations/i],
      ['CINQ', 20, /au moins 30\.00 DT/],
    ];
    for (const [code, montant, motif] of cas) {
      const res = await verifier(client.token, { code, montant });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(motif);
    }
  });
});

describe('Commande avec code promo et livraison', () => {
  beforeAll(async () => {
    await creerCode({ code: 'LIMITE2', type: 'montant', valeur: 10, utilisations_max: 2 });
    await creerCode({ code: 'REMISE20', type: 'pourcentage', valeur: 20 });
  });

  test('remise recalculée côté serveur, sauvegardée avec l\'adresse, visible dans le détail et les listes', async () => {
    const res = await commander(client.token, {
      code_promo: 'remise20', adresse_livraison: '12 rue de la Plage', ville: 'Mahdia', telephone: '22 333 444',
    }, 2); // 100 DT
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ sous_total: 100, remise: 20, code_promo: 'REMISE20', total: 80 });
    expect(await utilisations('REMISE20')).toBe(1);

    const detail = await api().get(`/api/commandes/${res.body.id}`).set(avec(client.token));
    expect(detail.body).toMatchObject({
      total: 80, remise: 20, code_promo: 'REMISE20', adresse_livraison: '12 rue de la Plage', ville: 'Mahdia', telephone: '22 333 444',
    });
    const mes = await api().get('/api/commandes/mes-commandes').set(avec(client.token));
    expect(mes.body[0]).toMatchObject({ remise: 20, ville: 'Mahdia' });
    const toutes = await api().get('/api/commandes').set(avec(admin.token));
    expect(toutes.body.find((c) => c.id === res.body.id)).toMatchObject({ remise: 20, code_promo: 'REMISE20' });
  });

  test('un montant envoyé par le client est ignoré : seul le code compte', async () => {
    const res = await commander(client.token, { code_promo: 'REMISE20', remise: 9999, total: 1 });
    expect(res.body).toMatchObject({ remise: 10, total: 40 });
  });

  test('sans code : remise 0, adresse facultative', async () => {
    const res = await commander(client.token);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ remise: 0, code_promo: null, total: 50 });
  });

  test('code invalide → 400 et rien n\'est modifié (stock et utilisations intacts)', async () => {
    const stockAvant = (await api().get(`/api/produits/${produit}`)).body.stock;
    const res = await commander(client.token, { code_promo: 'FAUX' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inconnu/i);
    expect((await api().get(`/api/produits/${produit}`)).body.stock).toBe(stockAvant);
  });

  test('téléphone invalide → 400', async () => {
    expect((await commander(client.token, { telephone: 'abc' })).status).toBe(400);
  });

  test('utilisations_max : la 3e commande est refusée ; annuler une commande libère le code', async () => {
    const a = await commander(client.token, { code_promo: 'LIMITE2' });
    const b = await commander(autre.token, { code_promo: 'LIMITE2' });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await utilisations('LIMITE2')).toBe(2);

    const refus = await commander(client.token, { code_promo: 'LIMITE2' });
    expect(refus.status).toBe(400);
    expect(refus.body.message).toMatch(/utilisations/i);

    await api().patch(`/api/commandes/${a.body.id}/annuler`).set(avec(client.token));
    expect(await utilisations('LIMITE2')).toBe(1);
    expect((await commander(client.token, { code_promo: 'LIMITE2' })).status).toBe(201);
  });

  test('deux commandes simultanées avec la dernière utilisation : une seule passe', async () => {
    await creerCode({ code: 'DERNIER', type: 'montant', valeur: 5, utilisations_max: 1 });
    const [r1, r2] = await Promise.all([
      commander(client.token, { code_promo: 'DERNIER' }),
      commander(autre.token, { code_promo: 'DERNIER' }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 400]);
    expect(await utilisations('DERNIER')).toBe(1);
  });

  test('facture PDF avec remise et adresse', async () => {
    const c = await commander(client.token, { code_promo: 'REMISE20', adresse_livraison: '5 avenue Habib Bourguiba', ville: 'Mahdia' });
    const res = await api().get(`/api/commandes/${c.body.id}/facture`).set(avec(client.token)).buffer(true).parse((r, cb) => {
      const morceaux = [];
      r.on('data', (m) => morceaux.push(m));
      r.on('end', () => cb(null, Buffer.concat(morceaux)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
