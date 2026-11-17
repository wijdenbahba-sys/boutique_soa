const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;
let fournisseurId;
let p1;
let p2;

const stockDe = async (id) => (await api().get(`/api/produits/${id}`)).body.stock;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
  p1 = await creerProduit(admin.token, { nom: 'Écouteurs', stock: 2, seuil_alerte: 5 });
  p2 = await creerProduit(admin.token, { nom: 'Câble', stock: 50, seuil_alerte: 10 });
});
afterAll(fermer);

describe('Fournisseurs', () => {
  test('réservé à l\'admin', async () => {
    expect((await api().get('/api/fournisseurs')).status).toBe(401);
    expect((await api().get('/api/fournisseurs').set(avec(client.token))).status).toBe(403);
  });

  test('création, lecture, modification', async () => {
    const res = await api().post('/api/fournisseurs').set(avec(admin.token)).send({ nom: 'TechDistrib', email: 'Contact@TechDistrib.tn', telephone: '71 000 111' });
    expect(res.status).toBe(201);
    fournisseurId = res.body.id;
    expect(res.body.email).toBe('contact@techdistrib.tn');

    expect((await api().get(`/api/fournisseurs/${fournisseurId}`).set(avec(admin.token))).body.nom).toBe('TechDistrib');
    const maj = await api().put(`/api/fournisseurs/${fournisseurId}`).set(avec(admin.token)).send({ nom: 'TechDistrib Plus', adresse: 'Tunis' });
    expect(maj.status).toBe(200);
    expect(maj.body).toMatchObject({ nom: 'TechDistrib Plus', adresse: 'Tunis', email: null });
  });

  test('nom en double → 409 ; email invalide ou nom vide → 400 ; inconnu → 404', async () => {
    expect((await api().post('/api/fournisseurs').set(avec(admin.token)).send({ nom: 'TechDistrib Plus' })).status).toBe(409);
    expect((await api().post('/api/fournisseurs').set(avec(admin.token)).send({ nom: 'X', email: 'pas-un-email' })).status).toBe(400);
    expect((await api().post('/api/fournisseurs').set(avec(admin.token)).send({ nom: '' })).status).toBe(400);
    expect((await api().get('/api/fournisseurs/9999').set(avec(admin.token))).status).toBe(404);
  });
});

describe('Achats et réapprovisionnement', () => {
  let achatId;

  test('suggestions : seulement les produits sous le seuil, avec une quantité conseillée', async () => {
    const res = await api().get('/api/achats/suggestions').set(avec(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ nom: 'Écouteurs', stock: 2, seuil_alerte: 5, quantite_suggeree: 8 }); // 5 x 2 - 2
  });

  test('création : total calculé côté serveur, le stock ne bouge PAS encore', async () => {
    const res = await api().post('/api/achats').set(avec(admin.token)).send({
      fournisseur_id: fournisseurId,
      lignes: [{ produit_id: p1, quantite: 8, cout_unitaire: 60 }, { produit_id: p2, quantite: 10, cout_unitaire: '2.5' }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ statut: 'commande', total: 505 }); // 8 x 60 + 10 x 2.5
    achatId = res.body.id;
    expect(await stockDe(p1)).toBe(2);
  });

  test('validation : fournisseur/produit inconnus → 404, lignes vides ou quantité 0 → 400', async () => {
    const ligne = [{ produit_id: p1, quantite: 1, cout_unitaire: 1 }];
    expect((await api().post('/api/achats').set(avec(admin.token)).send({ fournisseur_id: 9999, lignes: ligne })).status).toBe(404);
    expect((await api().post('/api/achats').set(avec(admin.token)).send({ fournisseur_id: fournisseurId, lignes: [{ produit_id: 9999, quantite: 1, cout_unitaire: 1 }] })).status).toBe(404);
    expect((await api().post('/api/achats').set(avec(admin.token)).send({ fournisseur_id: fournisseurId, lignes: [] })).status).toBe(400);
    expect((await api().post('/api/achats').set(avec(admin.token)).send({ fournisseur_id: fournisseurId, lignes: [{ produit_id: p1, quantite: 0, cout_unitaire: 1 }] })).status).toBe(400);
  });

  test('détail avec lignes et sous-totaux ; liste filtrable', async () => {
    const d = (await api().get(`/api/achats/${achatId}`).set(avec(admin.token))).body;
    expect(d.fournisseur_nom).toBe('TechDistrib Plus');
    expect(d.lignes).toHaveLength(2);
    expect(d.lignes[0]).toMatchObject({ produit_nom: 'Écouteurs', sous_total: 480 });

    expect((await api().get('/api/achats?statut=commande').set(avec(admin.token))).body).toHaveLength(1);
    expect((await api().get('/api/achats?statut=recu').set(avec(admin.token))).body).toHaveLength(0);
  });

  test('réception : le stock augmente, mouvements "reception", statut "recu"', async () => {
    const res = await api().patch(`/api/achats/${achatId}/recevoir`).set(avec(admin.token));
    expect(res.status).toBe(200);
    expect(await stockDe(p1)).toBe(10);
    expect(await stockDe(p2)).toBe(60);

    const [mvts] = await pool.query("SELECT produit_id, quantite, stock_apres FROM mouvements_stock WHERE achat_id = ? ORDER BY produit_id", [achatId]);
    expect(mvts).toEqual([
      { produit_id: p1, quantite: 8, stock_apres: 10 },
      { produit_id: p2, quantite: 10, stock_apres: 60 },
    ]);
    const d = (await api().get(`/api/achats/${achatId}`).set(avec(admin.token))).body;
    expect(d.statut).toBe('recu');
    expect(d.date_reception).not.toBeNull();
  });

  test('on ne peut pas recevoir deux fois (pas de double stock) ni annuler un achat reçu', async () => {
    expect((await api().patch(`/api/achats/${achatId}/recevoir`).set(avec(admin.token))).status).toBe(400);
    expect((await api().patch(`/api/achats/${achatId}/annuler`).set(avec(admin.token))).status).toBe(400);
    expect(await stockDe(p1)).toBe(10);
  });

  test("annulation d'un achat en cours : OK, sans effet sur le stock ; réception impossible ensuite", async () => {
    const a = (await api().post('/api/achats').set(avec(admin.token)).send({ fournisseur_id: fournisseurId, lignes: [{ produit_id: p1, quantite: 5, cout_unitaire: 1 }] })).body;
    expect((await api().patch(`/api/achats/${a.id}/annuler`).set(avec(admin.token))).status).toBe(200);
    expect((await api().patch(`/api/achats/${a.id}/recevoir`).set(avec(admin.token))).status).toBe(400);
    expect(await stockDe(p1)).toBe(10);
  });

  test('achat inconnu → 404', async () => {
    expect((await api().get('/api/achats/9999').set(avec(admin.token))).status).toBe(404);
    expect((await api().patch('/api/achats/9999/recevoir').set(avec(admin.token))).status).toBe(404);
    expect((await api().patch('/api/achats/9999/annuler').set(avec(admin.token))).status).toBe(404);
  });

  test('un fournisseur qui a des achats ne peut pas être supprimé (409) ; sans achat : OK', async () => {
    expect((await api().delete(`/api/fournisseurs/${fournisseurId}`).set(avec(admin.token))).status).toBe(409);
    const libre = (await api().post('/api/fournisseurs').set(avec(admin.token)).send({ nom: 'Sans achat' })).body;
    expect((await api().delete(`/api/fournisseurs/${libre.id}`).set(avec(admin.token))).status).toBe(200);
  });

  test('un produit présent dans un achat ne peut pas être supprimé (409)', async () => {
    expect((await api().delete(`/api/produits/${p1}`).set(avec(admin.token))).status).toBe(409);
  });

  test('un client ne peut pas utiliser les achats', async () => {
    expect((await api().get('/api/achats').set(avec(client.token))).status).toBe(403);
    expect((await api().post('/api/achats').set(avec(client.token)).send({})).status).toBe(403);
  });
});
