const { api, reinitialiser, creerAdmin, avec, fermer } = require('../helpers');

beforeAll(reinitialiser);
afterAll(fermer);

describe('Authentification', () => {
  test("inscription : crée un client, sans jamais renvoyer le mot de passe", async () => {
    const res = await api().post('/api/auth/register').send({ nom: 'Sarra', email: 'sarra@test.tn', mot_de_passe: 'secret1' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ nom: 'Sarra', email: 'sarra@test.tn', role: 'client' });
    expect(JSON.stringify(res.body)).not.toMatch(/secret1|mot_de_passe/);
  });

  test("inscription : un utilisateur ne peut pas se donner le rôle admin", async () => {
    const res = await api().post('/api/auth/register').send({ nom: 'Pirate', email: 'pirate@test.tn', mot_de_passe: 'secret1', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('client');
  });

  test('inscription : email déjà utilisé → 409 (même en changeant la casse)', async () => {
    const res = await api().post('/api/auth/register').send({ nom: 'Autre', email: 'SARRA@test.tn', mot_de_passe: 'secret1' });
    expect(res.status).toBe(409);
  });

  test('inscription : champs invalides → 400', async () => {
    expect((await api().post('/api/auth/register').send({ nom: 'X', email: 'pas-un-email', mot_de_passe: 'secret1' })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({ nom: 'X', email: 'x@test.tn', mot_de_passe: '123' })).status).toBe(400);
    expect((await api().post('/api/auth/register').send({})).status).toBe(400);
  });

  test('connexion : renvoie un token JWT et le profil', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'sarra@test.tn', mot_de_passe: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.user.email).toBe('sarra@test.tn');
  });

  test('connexion : mauvais mot de passe et email inconnu donnent le même message 401', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'sarra@test.tn', mot_de_passe: 'faux' });
    const b = await api().post('/api/auth/login').send({ email: 'inconnu@test.tn', mot_de_passe: 'faux' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  test('/me : 401 sans token, profil avec token', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    const { token } = (await api().post('/api/auth/login').send({ email: 'sarra@test.tn', mot_de_passe: 'secret1' })).body;
    const res = await api().get('/api/auth/me').set(avec(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sarra@test.tn');
  });

  test("un admin créé en base peut se connecter avec le rôle admin", async () => {
    const { user } = await creerAdmin();
    expect(user.role).toBe('admin');
  });
});
