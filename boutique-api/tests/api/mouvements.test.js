const { api, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;
let prod;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
  prod = await creerProduit(admin.token, { nom: 'Tracé', prix: 10, stock: 10 }); // mouvement "initial" +10
  await api().patch(`/api/produits/${prod}/stock`).set(avec(admin.token)).send({ ajustement: 5, motif: 'Inventaire' }); // +5
  const cmd = await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: prod, quantite: 3 }] }); // -3
  await api().patch(`/api/commandes/${cmd.body.id}/annuler`).set(avec(client.token)); // +3
});
afterAll(fermer);

describe('Historique des mouvements de stock', () => {
  test('réservé à l\'admin', async () => {
    expect((await api().get('/api/mouvements')).status).toBe(401);
    expect((await api().get('/api/mouvements').set(avec(client.token))).status).toBe(403);
  });

  test('raconte toute la vie du produit, du plus récent au plus ancien, avec le stock après chaque mouvement', async () => {
    const res = await api().get(`/api/mouvements?produit_id=${prod}`).set(avec(admin.token));
    expect(res.status).toBe(200);
    const lignes = res.body.data.map((m) => [m.type, m.quantite, m.stock_apres]);
    expect(lignes).toEqual([
      ['annulation', 3, 15],
      ['vente', -3, 12],
      ['ajustement', 5, 15],
      ['initial', 10, 10],
    ]);
    expect(res.body.data[2]).toMatchObject({ motif: 'Inventaire', utilisateur_nom: 'Admin', produit_nom: 'Tracé' });
  });

  test("cohérence : la somme des variations = le stock actuel", async () => {
    const mvts = (await api().get(`/api/mouvements?produit_id=${prod}`).set(avec(admin.token))).body.data;
    const somme = mvts.reduce((s, m) => s + m.quantite, 0);
    const stock = (await api().get(`/api/produits/${prod}`)).body.stock;
    expect(somme).toBe(stock);
  });

  test('filtre par type et pagination', async () => {
    const ventes = await api().get('/api/mouvements?type=vente').set(avec(admin.token));
    expect(ventes.body.data.every((m) => m.type === 'vente')).toBe(true);

    const page = await api().get(`/api/mouvements?produit_id=${prod}&page=2&limit=3`).set(avec(admin.token));
    expect(page.body.data).toHaveLength(1);
    expect(page.body.pagination).toEqual({ page: 2, limit: 3, total: 4, pages: 2 });
  });

  test('filtre par dates', async () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const dedans = await api().get(`/api/mouvements?du=${aujourdhui}&au=${aujourdhui}`).set(avec(admin.token));
    expect(dedans.body.pagination.total).toBeGreaterThan(0);
    const dehors = await api().get('/api/mouvements?du=2000-01-01&au=2000-01-02').set(avec(admin.token));
    expect(dehors.body.pagination.total).toBe(0);
  });
});
