const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
  const cat = await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Informatique' });
  const cat2 = await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Maison' });
  await creerProduit(admin.token, { nom: 'Clavier', prix: 45, stock: 30, category_id: cat.body.id });
  await creerProduit(admin.token, { nom: 'Souris', prix: 25.5, stock: 50, category_id: cat.body.id });
  await creerProduit(admin.token, { nom: 'Lampe', prix: 35, stock: 2, seuil_alerte: 3, category_id: cat2.body.id });
});
afterAll(fermer);

describe('Catalogue public', () => {
  test('GET /api/produits renvoie un tableau (compatibilité frontend)', async () => {
    const res = await api().get('/api/produits');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('categorie_nom');
  });

  test('recherche et filtre par catégorie', async () => {
    expect((await api().get('/api/produits?search=clav')).body.map((p) => p.nom)).toEqual(['Clavier']);
    const cat = (await api().get('/api/categories')).body.find((c) => c.nom === 'Maison');
    expect((await api().get(`/api/produits?categorie=${cat.id}`)).body.map((p) => p.nom)).toEqual(['Lampe']);
  });

  test('tri par prix décroissant', async () => {
    const res = await api().get('/api/produits?tri=prix&ordre=desc');
    expect(res.body.map((p) => p.prix)).toEqual([45, 35, 25.5]);
  });

  test('pagination : { data, pagination }', async () => {
    const res = await api().get('/api/produits?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, pages: 2 });
  });

  test('filtre alerte=true : seulement les stocks sous le seuil', async () => {
    const res = await api().get('/api/produits?alerte=true');
    expect(res.body.map((p) => p.nom)).toEqual(['Lampe']);
  });

  test("une tentative d'injection SQL dans le tri ou la recherche ne casse rien", async () => {
    expect((await api().get('/api/produits?tri=nom;DROP TABLE produits&ordre=asc')).status).toBe(200);
    expect((await api().get("/api/produits?search=' OR 1=1 --")).body).toEqual([]);
    expect((await api().get('/api/produits')).body).toHaveLength(3);
  });

  test('produit inexistant → 404', async () => {
    expect((await api().get('/api/produits/99999')).status).toBe(404);
  });
});

describe('Gestion des produits (admin)', () => {
  test('401 sans token, 403 pour un client', async () => {
    const corps = { nom: 'X', prix: 1 };
    expect((await api().post('/api/produits').send(corps)).status).toBe(401);
    expect((await api().post('/api/produits').set(avec(client.token)).send(corps)).status).toBe(403);
  });

  test('création : valeurs par défaut, historique "initial" enregistré', async () => {
    const res = await api().post('/api/produits').set(avec(admin.token)).send({ nom: 'Webcam', prix: '59.9', stock: 8 });
    expect(res.status).toBe(201);
    const p = (await api().get(`/api/produits/${res.body.id}`)).body;
    expect(p).toMatchObject({ nom: 'Webcam', prix: 59.9, stock: 8, seuil_alerte: 5, category_id: null });
    const [[mvt]] = await pool.query('SELECT * FROM mouvements_stock WHERE produit_id = ?', [res.body.id]);
    expect(mvt).toMatchObject({ type: 'initial', quantite: 8, stock_apres: 8 });
  });

  test('création invalide → 400 avec le détail des champs', async () => {
    const res = await api().post('/api/produits').set(avec(admin.token)).send({ nom: '', prix: -5 });
    expect(res.status).toBe(400);
    expect(res.body.erreurs.map((e) => e.champ)).toEqual(expect.arrayContaining(['nom', 'prix']));
  });

  test("catégorie inexistante → 400", async () => {
    const res = await api().post('/api/produits').set(avec(admin.token)).send({ nom: 'Z', prix: 1, category_id: 9999 });
    expect(res.status).toBe(400);
  });

  test('modification : changer le stock crée un mouvement "modification"', async () => {
    const id = await creerProduit(admin.token, { nom: 'À modifier', stock: 10 });
    const res = await api().put(`/api/produits/${id}`).set(avec(admin.token)).send({ nom: 'Modifié', prix: 12, stock: 14, seuil_alerte: 2 });
    expect(res.status).toBe(200);
    const [mvts] = await pool.query("SELECT quantite, stock_apres FROM mouvements_stock WHERE produit_id = ? AND type = 'modification'", [id]);
    expect(mvts).toEqual([{ quantite: 4, stock_apres: 14 }]);
  });

  test('modification sans changer le stock : aucun mouvement', async () => {
    const id = await creerProduit(admin.token, { nom: 'Stable', stock: 10 });
    await api().put(`/api/produits/${id}`).set(avec(admin.token)).send({ nom: 'Stable 2', prix: 99, stock: 10, seuil_alerte: 5 });
    const [mvts] = await pool.query("SELECT id FROM mouvements_stock WHERE produit_id = ? AND type = 'modification'", [id]);
    expect(mvts).toHaveLength(0);
  });

  test('modification / suppression d\'un produit inexistant → 404', async () => {
    expect((await api().put('/api/produits/9999').set(avec(admin.token)).send({ nom: 'X', prix: 1, stock: 1 })).status).toBe(404);
    expect((await api().delete('/api/produits/9999').set(avec(admin.token))).status).toBe(404);
  });

  test('suppression OK, puis 404', async () => {
    const id = await creerProduit(admin.token, { nom: 'Jetable' });
    expect((await api().delete(`/api/produits/${id}`).set(avec(admin.token))).status).toBe(200);
    expect((await api().get(`/api/produits/${id}`)).status).toBe(404);
  });

  test('suppression refusée (409) si le produit figure dans une commande', async () => {
    const id = await creerProduit(admin.token, { nom: 'Vendu', stock: 5 });
    await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: id, quantite: 1 }] });
    expect((await api().delete(`/api/produits/${id}`).set(avec(admin.token))).status).toBe(409);
  });
});

describe('Ajustement du stock', () => {
  test('+10 puis -3, avec motif dans l\'historique', async () => {
    const id = await creerProduit(admin.token, { nom: 'Ajustable', stock: 5 });
    const a = await api().patch(`/api/produits/${id}/stock`).set(avec(admin.token)).send({ ajustement: 10, motif: 'Inventaire' });
    expect(a.body.stock).toBe(15);
    const b = await api().patch(`/api/produits/${id}/stock`).set(avec(admin.token)).send({ ajustement: -3 });
    expect(b.body.stock).toBe(12);
    const [mvts] = await pool.query("SELECT quantite, stock_apres, motif FROM mouvements_stock WHERE produit_id = ? AND type = 'ajustement' ORDER BY id", [id]);
    expect(mvts).toEqual([
      { quantite: 10, stock_apres: 15, motif: 'Inventaire' },
      { quantite: -3, stock_apres: 12, motif: null },
    ]);
  });

  test('le stock ne peut jamais devenir négatif (400, rien n\'est modifié)', async () => {
    const id = await creerProduit(admin.token, { nom: 'Presque vide', stock: 2 });
    const res = await api().patch(`/api/produits/${id}/stock`).set(avec(admin.token)).send({ ajustement: -5 });
    expect(res.status).toBe(400);
    expect((await api().get(`/api/produits/${id}`)).body.stock).toBe(2);
  });

  test('ajustement 0, texte ou manquant → 400 ; produit inconnu → 404 ; client → 403', async () => {
    const id = await creerProduit(admin.token, { nom: 'Autre' });
    for (const corps of [{ ajustement: 0 }, { ajustement: 'beaucoup' }, {}]) {
      expect((await api().patch(`/api/produits/${id}/stock`).set(avec(admin.token)).send(corps)).status).toBe(400);
    }
    expect((await api().patch('/api/produits/9999/stock').set(avec(admin.token)).send({ ajustement: 1 })).status).toBe(404);
    expect((await api().patch(`/api/produits/${id}/stock`).set(avec(client.token)).send({ ajustement: 1 })).status).toBe(403);
  });
});

describe('Alertes de stock', () => {
  test('/alertes liste les produits sous le seuil (admin uniquement)', async () => {
    expect((await api().get('/api/produits/alertes')).status).toBe(401);
    const res = await api().get('/api/produits/alertes').set(avec(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.nom)).toContain('Lampe');
  });
});
