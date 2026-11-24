const { api, reinitialiser, creerAdmin, creerClient, connecter, avec, fermer } = require('../helpers');

let client;

beforeAll(async () => {
  await reinitialiser();
  await creerAdmin();
  client = await creerClient('sarra@test.tn', 'secret12');
  await creerClient('autre@test.tn', 'secret12');
});
afterAll(fermer);

describe('PUT /api/auth/profil', () => {
  test('401 sans token', async () => {
    expect((await api().put('/api/auth/profil').send({ nom: 'X', email: 'x@test.tn' })).status).toBe(401);
  });

  test('400 : nom vide ou email invalide', async () => {
    expect((await api().put('/api/auth/profil').set(avec(client.token)).send({ nom: '', email: 'x@test.tn' })).status).toBe(400);
    expect((await api().put('/api/auth/profil').set(avec(client.token)).send({ nom: 'Sarra', email: 'pas-un-email' })).status).toBe(400);
  });

  test('409 si l\'email est déjà pris par un autre compte', async () => {
    const res = await api().put('/api/auth/profil').set(avec(client.token)).send({ nom: 'Sarra', email: 'autre@test.tn' });
    expect(res.status).toBe(409);
  });

  test('OK : renvoie l\'utilisateur à jour (rôle inchangé) et la connexion marche avec le nouvel email', async () => {
    const res = await api().put('/api/auth/profil').set(avec(client.token)).send({ nom: 'Sarra B.', email: 'Sarra.New@Test.tn' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ nom: 'Sarra B.', email: 'sarra.new@test.tn', role: 'client' });
    expect((await connecter('sarra.new@test.tn', 'secret12')).token).toBeTruthy();
    // garder son propre email est permis
    expect((await api().put('/api/auth/profil').set(avec(client.token)).send({ nom: 'Sarra', email: 'sarra.new@test.tn' })).status).toBe(200);
  });
});

describe('PUT /api/auth/mot-de-passe', () => {
  test('401 sans token', async () => {
    expect((await api().put('/api/auth/mot-de-passe').send({ ancien: 'a', nouveau: 'abcdef' })).status).toBe(401);
  });

  test('400 : ancien mot de passe faux, nouveau trop court ou champs manquants', async () => {
    const faux = await api().put('/api/auth/mot-de-passe').set(avec(client.token)).send({ ancien: 'mauvais', nouveau: 'nouveau12' });
    expect(faux.status).toBe(400);
    expect(faux.body.message).toMatch(/ancien mot de passe/i);
    expect((await api().put('/api/auth/mot-de-passe').set(avec(client.token)).send({ ancien: 'secret12', nouveau: '123' })).status).toBe(400);
    expect((await api().put('/api/auth/mot-de-passe').set(avec(client.token)).send({})).status).toBe(400);
  });

  test('OK : l\'ancien mot de passe ne marche plus, le nouveau oui', async () => {
    const res = await api().put('/api/auth/mot-de-passe').set(avec(client.token)).send({ ancien: 'secret12', nouveau: 'nouveau12' });
    expect(res.status).toBe(200);
    const ancien = await api().post('/api/auth/login').send({ email: 'sarra.new@test.tn', mot_de_passe: 'secret12' });
    expect(ancien.status).toBe(401);
    expect((await connecter('sarra.new@test.tn', 'nouveau12')).token).toBeTruthy();
  });
});
