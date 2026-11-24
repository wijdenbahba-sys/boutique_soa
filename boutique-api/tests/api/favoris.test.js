const { api, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;
let autre;
let p1;
let p2;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient('c1@test.tn');
  autre = await creerClient('c2@test.tn');
  p1 = await creerProduit(admin.token, { nom: 'Clavier' });
  p2 = await creerProduit(admin.token, { nom: 'Souris' });
});
afterAll(fermer);

describe('Favoris', () => {
  test('401 sans token, 403 pour un admin', async () => {
    for (const [methode, url] of [['get', '/api/favoris'], ['get', '/api/favoris/ids'], ['post', `/api/favoris/${p1}`], ['delete', `/api/favoris/${p1}`]]) {
      expect((await api()[methode](url)).status).toBe(401);
      expect((await api()[methode](url).set(avec(admin.token))).status).toBe(403);
    }
  });

  test('ajout : 201 la première fois, 200 ensuite (idempotent), 404 si le produit n\'existe pas', async () => {
    expect((await api().post(`/api/favoris/${p1}`).set(avec(client.token))).status).toBe(201);
    expect((await api().post(`/api/favoris/${p1}`).set(avec(client.token))).status).toBe(200);
    expect((await api().post('/api/favoris/99999').set(avec(client.token))).status).toBe(404);
    const ids = await api().get('/api/favoris/ids').set(avec(client.token));
    expect(ids.body).toEqual([p1]); // pas de doublon
  });

  test('GET /api/favoris renvoie des produits complets (catégorie, note, image)', async () => {
    await api().post(`/api/favoris/${p2}`).set(avec(client.token));
    const res = await api().get('/api/favoris').set(avec(client.token));
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.nom).sort()).toEqual(['Clavier', 'Souris']);
    expect(res.body[0]).toHaveProperty('prix');
    expect(res.body[0]).toHaveProperty('image_url');
    expect(res.body[0]).toHaveProperty('nb_avis');
  });

  test('chaque client ne voit que ses propres favoris', async () => {
    expect((await api().get('/api/favoris/ids').set(avec(autre.token))).body).toEqual([]);
  });

  test('retrait : 200 puis 404 ; supprimer un produit le retire des favoris', async () => {
    expect((await api().delete(`/api/favoris/${p1}`).set(avec(client.token))).status).toBe(200);
    expect((await api().delete(`/api/favoris/${p1}`).set(avec(client.token))).status).toBe(404);
    await api().delete(`/api/produits/${p2}`).set(avec(admin.token));
    expect((await api().get('/api/favoris/ids').set(avec(client.token))).body).toEqual([]);
  });
});
