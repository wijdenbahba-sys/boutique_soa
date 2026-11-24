const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;
let autreClient;
let p1;
let p2;

const stockDe = async (id) => (await api().get(`/api/produits/${id}`)).body.stock;

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient('c1@test.tn');
  autreClient = await creerClient('c2@test.tn');
  p1 = await creerProduit(admin.token, { nom: 'Clavier', prix: 45, stock: 10 });
  p2 = await creerProduit(admin.token, { nom: 'Souris', prix: 25.5, stock: 3 });
});
afterAll(fermer);

describe('Création de commande', () => {
  test('401 sans token ; 403 pour un admin (seuls les clients commandent)', async () => {
    const corps = { produits: [{ produit_id: p1, quantite: 1 }] };
    expect((await api().post('/api/commandes').send(corps)).status).toBe(401);
    expect((await api().post('/api/commandes').set(avec(admin.token)).send(corps)).status).toBe(403);
  });

  test('corps invalide → 400', async () => {
    for (const corps of [{}, { produits: [] }, { produits: [{ produit_id: p1, quantite: 0 }] }, { produits: [{ produit_id: 'x', quantite: 1 }] }]) {
      expect((await api().post('/api/commandes').set(avec(client.token)).send(corps)).status).toBe(400);
    }
  });

  test('commande OK : total calculé côté serveur, stock décrémenté, mouvements "vente"', async () => {
    const res = await api().post('/api/commandes').set(avec(client.token)).send({
      produits: [{ produit_id: p1, quantite: 2 }, { produit_id: p2, quantite: 1 }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ statut: 'en_attente', total: 115.5 }); // 2 x 45 + 25.50

    expect(await stockDe(p1)).toBe(8);
    expect(await stockDe(p2)).toBe(2);

    const [mvts] = await pool.query("SELECT produit_id, quantite, stock_apres FROM mouvements_stock WHERE type = 'vente' AND commande_id = ? ORDER BY produit_id", [res.body.id]);
    expect(mvts).toEqual([
      { produit_id: p1, quantite: -2, stock_apres: 8 },
      { produit_id: p2, quantite: -1, stock_apres: 2 },
    ]);
  });

  test('les lignes en double sont regroupées', async () => {
    const res = await api().post('/api/commandes').set(avec(client.token)).send({
      produits: [{ produit_id: p1, quantite: 1 }, { produit_id: p1, quantite: 2 }],
    });
    expect(res.status).toBe(201);
    const detail = (await api().get(`/api/commandes/${res.body.id}`).set(avec(client.token))).body;
    expect(detail.lignes).toHaveLength(1);
    expect(detail.lignes[0].quantite).toBe(3);
  });

  test('stock insuffisant → 400 et ROLLBACK : aucun stock ni commande modifié', async () => {
    const avant = { p1: await stockDe(p1), p2: await stockDe(p2) };
    const [[{ n: commandesAvant }]] = await pool.query('SELECT COUNT(*) AS n FROM commandes');

    // p1 est suffisant, p2 ne l'est pas : la 1re ligne ne doit PAS rester appliquée
    const res = await api().post('/api/commandes').set(avec(client.token)).send({
      produits: [{ produit_id: p1, quantite: 1 }, { produit_id: p2, quantite: 99 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Stock insuffisant/);

    expect(await stockDe(p1)).toBe(avant.p1);
    expect(await stockDe(p2)).toBe(avant.p2);
    const [[{ n: commandesApres }]] = await pool.query('SELECT COUNT(*) AS n FROM commandes');
    expect(commandesApres).toBe(commandesAvant);
  });

  test('produit inexistant → 404', async () => {
    const res = await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: 99999, quantite: 1 }] });
    expect(res.status).toBe(404);
  });

  test('deux commandes simultanées sur le dernier article : une seule passe (verrou FOR UPDATE)', async () => {
    const rare = await creerProduit(admin.token, { nom: 'Dernier exemplaire', prix: 10, stock: 1 });
    const corps = { produits: [{ produit_id: rare, quantite: 1 }] };
    const [a, b] = await Promise.all([
      api().post('/api/commandes').set(avec(client.token)).send(corps),
      api().post('/api/commandes').set(avec(autreClient.token)).send(corps),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(await stockDe(rare)).toBe(0);
  });
});

describe('Consultation et droits', () => {
  let commandeId;

  beforeAll(async () => {
    const res = await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: p1, quantite: 1 }] });
    commandeId = res.body.id;
  });

  test('mes-commandes : un client ne voit que les siennes', async () => {
    const mes = (await api().get('/api/commandes/mes-commandes').set(avec(client.token))).body;
    expect(mes.length).toBeGreaterThan(0);
    expect(mes.some((c) => c.id === commandeId)).toBe(true);
    // (autreClient peut avoir gagné la course du test précédent : on vérifie seulement qu'il ne voit pas NOTRE commande)
    const siennes = (await api().get('/api/commandes/mes-commandes').set(avec(autreClient.token))).body;
    expect(siennes.some((c) => c.id === commandeId)).toBe(false);
  });

  test("le détail d'une commande est réservé à son propriétaire et à l'admin", async () => {
    expect((await api().get(`/api/commandes/${commandeId}`).set(avec(client.token))).status).toBe(200);
    expect((await api().get(`/api/commandes/${commandeId}`).set(avec(admin.token))).status).toBe(200);
    expect((await api().get(`/api/commandes/${commandeId}`).set(avec(autreClient.token))).status).toBe(403);
    expect((await api().get('/api/commandes/99999').set(avec(client.token))).status).toBe(404);
  });

  test('la liste complète est réservée à l\'admin, avec filtre et pagination', async () => {
    expect((await api().get('/api/commandes').set(avec(client.token))).status).toBe(403);
    const tous = await api().get('/api/commandes').set(avec(admin.token));
    expect(Array.isArray(tous.body)).toBe(true);
    expect(tous.body[0]).toHaveProperty('client_email');

    const page = await api().get('/api/commandes?page=1&limit=2&tri=total&ordre=desc').set(avec(admin.token));
    expect(page.body.data).toHaveLength(2);
    expect(page.body.pagination.total).toBe(tous.body.length);
    expect(page.body.data[0].total).toBeGreaterThanOrEqual(page.body.data[1].total);

    const filtre = await api().get('/api/commandes?statut=livree').set(avec(admin.token));
    expect(filtre.body).toEqual([]);
  });

  test('changement de statut : admin uniquement, valeurs contrôlées', async () => {
    expect((await api().patch(`/api/commandes/${commandeId}/statut`).set(avec(client.token)).send({ statut: 'livree' })).status).toBe(403);
    expect((await api().patch(`/api/commandes/${commandeId}/statut`).set(avec(admin.token)).send({ statut: 'nimportequoi' })).status).toBe(400);
    expect((await api().patch(`/api/commandes/${commandeId}/statut`).set(avec(admin.token)).send({ statut: 'annulee' })).status).toBe(400);
    const ok = await api().patch(`/api/commandes/${commandeId}/statut`).set(avec(admin.token)).send({ statut: 'confirmee' });
    expect(ok.status).toBe(200);
    expect(ok.body.statut).toBe('confirmee');
  });
});

describe('Annulation', () => {
  test('remet le stock, journalise "annulation", et ne peut pas être refaite', async () => {
    const prod = await creerProduit(admin.token, { nom: 'À annuler', prix: 10, stock: 10 });
    const cmd = (await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: prod, quantite: 4 }] })).body;
    expect(await stockDe(prod)).toBe(6);

    const res = await api().patch(`/api/commandes/${cmd.id}/annuler`).set(avec(client.token));
    expect(res.status).toBe(200);
    expect(await stockDe(prod)).toBe(10);

    const [mvts] = await pool.query("SELECT quantite, stock_apres FROM mouvements_stock WHERE produit_id = ? AND type = 'annulation'", [prod]);
    expect(mvts).toEqual([{ quantite: 4, stock_apres: 10 }]);

    expect((await api().patch(`/api/commandes/${cmd.id}/annuler`).set(avec(client.token))).status).toBe(400);
    expect(await stockDe(prod)).toBe(10); // pas de double remise en stock
  });

  test("un autre client ne peut pas annuler la commande ; l'admin le peut", async () => {
    const prod = await creerProduit(admin.token, { nom: 'Droits', stock: 5 });
    const cmd = (await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: prod, quantite: 1 }] })).body;
    expect((await api().patch(`/api/commandes/${cmd.id}/annuler`).set(avec(autreClient.token))).status).toBe(403);
    expect((await api().patch(`/api/commandes/${cmd.id}/annuler`).set(avec(admin.token))).status).toBe(200);
  });

  test('une commande livrée ne peut plus être annulée', async () => {
    const prod = await creerProduit(admin.token, { nom: 'Livré', stock: 5 });
    const cmd = (await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: prod, quantite: 1 }] })).body;
    await api().patch(`/api/commandes/${cmd.id}/statut`).set(avec(admin.token)).send({ statut: 'livree' });
    expect((await api().patch(`/api/commandes/${cmd.id}/annuler`).set(avec(client.token))).status).toBe(400);
  });
});

describe('Facture PDF', () => {
  let cmd;
  beforeAll(async () => {
    const prod = await creerProduit(admin.token, { nom: 'Facturé', prix: 12.5, stock: 5 });
    cmd = (await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: prod, quantite: 2 }] })).body;
  });

  test('le propriétaire et l\'admin reçoivent un vrai PDF', async () => {
    for (const token of [client.token, admin.token]) {
      const res = await api().get(`/api/commandes/${cmd.id}/facture`).set(avec(token)).buffer(true).parse((r, cb) => {
        const morceaux = [];
        r.on('data', (m) => morceaux.push(m));
        r.on('end', () => cb(null, Buffer.concat(morceaux)));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
      expect(res.body.length).toBeGreaterThan(1000);
    }
  });

  test('401 sans token, 403 pour un autre client, 404 si inconnue', async () => {
    expect((await api().get(`/api/commandes/${cmd.id}/facture`)).status).toBe(401);
    expect((await api().get(`/api/commandes/${cmd.id}/facture`).set(avec(autreClient.token))).status).toBe(403);
    expect((await api().get('/api/commandes/99999/facture').set(avec(admin.token))).status).toBe(404);
  });

  test('pas de facture pour une commande annulée', async () => {
    await api().patch(`/api/commandes/${cmd.id}/annuler`).set(avec(client.token));
    expect((await api().get(`/api/commandes/${cmd.id}/facture`).set(avec(client.token))).status).toBe(400);
  });
});
