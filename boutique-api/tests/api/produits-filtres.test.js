const { api, reinitialiser, creerAdmin, avec, creerProduit, fermer } = require('../helpers');

beforeAll(async () => {
  await reinitialiser();
  const admin = await creerAdmin();
  await creerProduit(admin.token, { nom: 'Bon marché', prix: 5, stock: 10 });
  await creerProduit(admin.token, { nom: 'Moyen', prix: 50, stock: 0 });
  await creerProduit(admin.token, { nom: 'Luxe', prix: 500, stock: 3 });
});
afterAll(fermer);

const noms = (res) => (Array.isArray(res.body) ? res.body : res.body.data).map((p) => p.nom);

describe('Filtres et tris v3 sur GET /api/produits', () => {
  test('prix_min et prix_max (bornes incluses), cumulables', async () => {
    expect(noms(await api().get('/api/produits?prix_min=50&tri=prix'))).toEqual(['Moyen', 'Luxe']);
    expect(noms(await api().get('/api/produits?prix_max=50&tri=prix'))).toEqual(['Bon marché', 'Moyen']);
    expect(noms(await api().get('/api/produits?prix_min=10&prix_max=100'))).toEqual(['Moyen']);
  });

  test('valeurs non numériques ignorées au lieu de planter', async () => {
    const res = await api().get('/api/produits?prix_min=abc&prix_max=');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  test('en_stock=1 masque les ruptures', async () => {
    expect(noms(await api().get('/api/produits?en_stock=1&tri=nom'))).toEqual(['Bon marché', 'Luxe']);
    expect(noms(await api().get('/api/produits?en_stock=true'))).not.toContain('Moyen');
  });

  test('les filtres fonctionnent avec la pagination (total cohérent)', async () => {
    const res = await api().get('/api/produits?en_stock=1&page=1&limit=1&tri=prix&ordre=desc');
    expect(res.body.pagination).toMatchObject({ total: 2, pages: 2, limit: 1 });
    expect(noms(res)).toEqual(['Luxe']);
  });

  test('tri par prix, nom et date ; un tri inconnu retombe sur le nom (pas d\'injection SQL)', async () => {
    expect(noms(await api().get('/api/produits?tri=prix&ordre=desc'))).toEqual(['Luxe', 'Moyen', 'Bon marché']);
    expect(noms(await api().get('/api/produits?tri=nom&ordre=asc'))).toEqual(['Bon marché', 'Luxe', 'Moyen']);
    expect((await api().get('/api/produits?tri=date&ordre=desc')).status).toBe(200);
    const inj = await api().get('/api/produits?tri=prix;DROP TABLE produits');
    expect(inj.status).toBe(200);
    expect(noms(inj)).toEqual(['Bon marché', 'Luxe', 'Moyen']);
    expect((await api().get('/api/produits')).body).toHaveLength(3);
  });

  test('tout produit expose image_url, note_moyenne et nb_avis', async () => {
    const [p] = (await api().get('/api/produits')).body;
    expect(p).toHaveProperty('image_url', null);
    expect(p).toHaveProperty('note_moyenne', null);
    expect(p).toHaveProperty('nb_avis', 0);
  });
});
