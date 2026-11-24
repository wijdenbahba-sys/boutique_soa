const { api, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let acheteur;
let curieux;
let produit;
let autreProduit;

const commander = (token, id) => api().post('/api/commandes').set(avec(token)).send({ produits: [{ produit_id: id, quantite: 1 }] });

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  acheteur = await creerClient('acheteur@test.tn');
  curieux = await creerClient('curieux@test.tn');
  produit = await creerProduit(admin.token, { nom: 'Clavier', prix: 45 });
  autreProduit = await creerProduit(admin.token, { nom: 'Souris', prix: 20 });
  await commander(acheteur.token, produit);
});
afterAll(fermer);

describe('Avis sur les produits', () => {
  test('lecture publique : produit sans avis → moyenne null, répartition à 0 ; 404 si produit inconnu', async () => {
    const res = await api().get(`/api/produits/${produit}/avis`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ moyenne: null, total: 0, repartition: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, avis: [] });
    expect((await api().get('/api/produits/99999/avis')).status).toBe(404);
  });

  test('401 sans token, 403 pour un admin', async () => {
    expect((await api().post(`/api/produits/${produit}/avis`).send({ note: 5 })).status).toBe(401);
    expect((await api().post(`/api/produits/${produit}/avis`).set(avec(admin.token)).send({ note: 5 })).status).toBe(403);
  });

  test('400 : note hors 1-5, décimale ou manquante', async () => {
    for (const note of [0, 6, 3.5, 'abc', undefined]) {
      const res = await api().post(`/api/produits/${produit}/avis`).set(avec(acheteur.token)).send({ note });
      expect(res.status).toBe(400);
    }
  });

  test('403 "Achat requis" si le client n\'a pas commandé ce produit', async () => {
    const res = await api().post(`/api/produits/${produit}/avis`).set(avec(curieux.token)).send({ note: 5 });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/achat requis/i);
    // acheter un AUTRE produit ne suffit pas
    await commander(curieux.token, autreProduit);
    expect((await api().post(`/api/produits/${produit}/avis`).set(avec(curieux.token)).send({ note: 5 })).status).toBe(403);
  });

  test('404 si le produit n\'existe pas', async () => {
    expect((await api().post('/api/produits/99999/avis').set(avec(acheteur.token)).send({ note: 4 })).status).toBe(404);
  });

  test('un achat annulé ne donne pas le droit de noter', async () => {
    const c = await commander(curieux.token, produit);
    await api().patch(`/api/commandes/${c.body.id}/annuler`).set(avec(curieux.token));
    expect((await api().post(`/api/produits/${produit}/avis`).set(avec(curieux.token)).send({ note: 1 })).status).toBe(403);
  });

  test('avis OK (201), puis modification par le même client (200, pas de doublon)', async () => {
    const premier = await api().post(`/api/produits/${produit}/avis`).set(avec(acheteur.token)).send({ note: 3, commentaire: 'Correct' });
    expect(premier.status).toBe(201);
    const second = await api().post(`/api/produits/${produit}/avis`).set(avec(acheteur.token)).send({ note: 5, commentaire: 'Excellent' });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(premier.body.id);

    const res = await api().get(`/api/produits/${produit}/avis`);
    expect(res.body.total).toBe(1);
    expect(res.body.moyenne).toBe(5);
    expect(res.body.repartition).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
    expect(res.body.avis[0]).toMatchObject({ note: 5, commentaire: 'Excellent', auteur: 'Client Test', user_id: acheteur.user.id });
  });

  test('la note moyenne et le nombre d\'avis apparaissent dans la liste et le détail des produits', async () => {
    await commander(curieux.token, produit); // nouvelle commande non annulée
    await api().post(`/api/produits/${produit}/avis`).set(avec(curieux.token)).send({ note: 2 });
    // moyenne de 5 et 2 = 3.5
    const detail = await api().get(`/api/produits/${produit}`);
    expect(detail.body).toMatchObject({ note_moyenne: 3.5, nb_avis: 2 });
    const liste = (await api().get('/api/produits')).body;
    expect(liste.find((p) => p.id === produit)).toMatchObject({ note_moyenne: 3.5, nb_avis: 2 });
    expect(liste.find((p) => p.id === autreProduit)).toMatchObject({ note_moyenne: null, nb_avis: 0 });
  });

  test('tri par note (liste blanche) : les mieux notés d\'abord', async () => {
    const res = await api().get('/api/produits?tri=note&ordre=desc');
    expect(res.body[0].id).toBe(produit);
    expect(res.body[res.body.length - 1].note_moyenne).toBeNull();
  });

  test('suppression : l\'auteur ou un admin ; 403 pour un autre client ; 404 si inconnu ; 401 sans token', async () => {
    const { body } = await api().get(`/api/produits/${produit}/avis`);
    const avisAcheteur = body.avis.find((a) => a.user_id === acheteur.user.id);
    const avisCurieux = body.avis.find((a) => a.user_id === curieux.user.id);

    expect((await api().delete(`/api/avis/${avisAcheteur.id}`)).status).toBe(401);
    expect((await api().delete(`/api/avis/${avisAcheteur.id}`).set(avec(curieux.token))).status).toBe(403);
    expect((await api().delete(`/api/avis/${avisAcheteur.id}`).set(avec(acheteur.token))).status).toBe(200);
    expect((await api().delete(`/api/avis/${avisCurieux.id}`).set(avec(admin.token))).status).toBe(200);
    expect((await api().delete(`/api/avis/${avisCurieux.id}`).set(avec(admin.token))).status).toBe(404);
    expect((await api().get(`/api/produits/${produit}/avis`)).body.total).toBe(0);
  });
});
