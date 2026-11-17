const { api, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
  const info = (await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Informatique' })).body;
  const maison = (await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Maison' })).body;
  const clavier = await creerProduit(admin.token, { nom: 'Clavier', prix: 45, stock: 10, seuil_alerte: 3, category_id: info.id });
  const lampe = await creerProduit(admin.token, { nom: 'Lampe', prix: 35, stock: 3, seuil_alerte: 3, category_id: maison.id });
  await creerProduit(admin.token, { nom: 'Orphelin', prix: 10, stock: 5, seuil_alerte: 1 }); // sans catégorie

  await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: clavier, quantite: 2 }, { produit_id: lampe, quantite: 1 }] }); // 125 DT
  const annulee = await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: clavier, quantite: 1 }] });
  await api().patch(`/api/commandes/${annulee.body.id}/annuler`).set(avec(client.token));
});
afterAll(fermer);

describe('Statistiques', () => {
  test('réservées à l\'admin', async () => {
    for (const url of ['/api/stats', '/api/stats/ventes', '/api/stats/par-categorie']) {
      expect((await api().get(url)).status).toBe(401);
      expect((await api().get(url).set(avec(client.token))).status).toBe(403);
    }
  });

  test('chiffres clés : les commandes annulées ne comptent pas dans le chiffre d\'affaires', async () => {
    const s = (await api().get('/api/stats').set(avec(admin.token))).body;
    expect(s.total_produits).toBe(3);
    expect(s.total_commandes).toBe(2);
    expect(s.chiffre_affaires).toBe(125);
    expect(s.produits_en_alerte).toBe(1); // Lampe : stock 2 <= seuil 3
    expect(s.valeur_stock).toBe(8 * 45 + 2 * 35 + 5 * 10); // stock actuel x prix
    expect(s.achats_en_cours).toBe(0);
    expect(s.commandes_par_statut).toEqual(expect.arrayContaining([{ statut: 'en_attente', nombre: 1 }, { statut: 'annulee', nombre: 1 }]));
    expect(s.top_produits[0]).toMatchObject({ nom: 'Clavier', quantite_vendue: 2 });
  });

  test('ventes par jour : une ligne par jour de la période, jours vides à 0', async () => {
    const v = (await api().get('/api/stats/ventes?jours=7').set(avec(admin.token))).body;
    expect(v).toHaveLength(7);
    // dates consécutives et croissantes
    for (let i = 1; i < v.length; i++) {
      expect(new Date(v[i].date) - new Date(v[i - 1].date)).toBe(24 * 3600 * 1000);
    }
    expect(v.slice(0, 6).every((j) => j.commandes === 0 && j.chiffre_affaires === 0)).toBe(true);
    expect(v[6]).toMatchObject({ commandes: 1, chiffre_affaires: 125 });
  });

  test('ventes : le paramètre "jours" est borné, une valeur absurde ne casse rien', async () => {
    expect((await api().get('/api/stats/ventes?jours=abc').set(avec(admin.token))).body).toHaveLength(30);
    expect((await api().get('/api/stats/ventes?jours=99999').set(avec(admin.token))).body).toHaveLength(365);
    expect((await api().get('/api/stats/ventes?jours=-5').set(avec(admin.token))).body).toHaveLength(1);
  });

  test('chiffre d\'affaires par catégorie', async () => {
    const c = (await api().get('/api/stats/par-categorie').set(avec(admin.token))).body;
    expect(c).toEqual([
      { categorie: 'Informatique', quantite_vendue: 2, chiffre_affaires: 90 },
      { categorie: 'Maison', quantite_vendue: 1, chiffre_affaires: 35 },
    ]);
  });
});
