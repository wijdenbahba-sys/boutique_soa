const { api, reinitialiser, creerClient, fermer } = require('../helpers');

beforeAll(reinitialiser);
afterAll(async () => {
  delete process.env.TEST_RATE_LIMIT;
  await fermer();
});

describe('Sécurité', () => {
  test('en-têtes de sécurité helmet présents', async () => {
    const res = await api().get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined(); // ne révèle pas "Express"
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  test('JSON mal formé → 400 (et non une erreur 500)', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{pas du json');
    expect(res.status).toBe(400);
  });

  test('corps trop volumineux → 413', async () => {
    const res = await api().post('/api/auth/register').send({ nom: 'x'.repeat(200000), email: 'a@b.tn', mot_de_passe: '123456' });
    expect(res.status).toBe(413);
  });

  test('route inconnue → 404 JSON', async () => {
    const res = await api().get('/api/nimporte');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  test("un token signé avec un autre secret est refusé", async () => {
    const jwt = require('jsonwebtoken');
    const faux = jwt.sign({ id: 1, role: 'admin' }, 'autre_secret');
    const res = await api().get('/api/stats').set('Authorization', `Bearer ${faux}`);
    expect(res.status).toBe(401);
  });

  test("un client ne peut pas se faire passer pour admin en modifiant son token (rôle dans le payload signé)", async () => {
    const { token } = await creerClient('malin@test.tn');
    const [entete, payload, signature] = token.split('.');
    const modifie = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), role: 'admin' })).toString('base64url');
    const res = await api().get('/api/stats').set('Authorization', `Bearer ${entete}.${modifie}.${signature}`);
    expect(res.status).toBe(401);
  });

  test('anti force brute : la 11e tentative de connexion ratée est bloquée (429)', async () => {
    process.env.TEST_RATE_LIMIT = '1';
    let dernier;
    for (let i = 0; i < 11; i++) {
      dernier = await api().post('/api/auth/login').send({ email: 'inconnu@test.tn', mot_de_passe: 'mauvais' });
      if (i < 10) expect(dernier.status).toBe(401);
    }
    expect(dernier.status).toBe(429);
    expect(dernier.body.message).toMatch(/Trop de tentatives/);
  });
});
