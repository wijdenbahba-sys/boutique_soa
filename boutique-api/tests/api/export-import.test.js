const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;

const telecharger = (token, url) => api().get(url).set(avec(token)).buffer(true).parse((res, cb) => {
  const morceaux = [];
  res.on('data', (m) => morceaux.push(m));
  res.on('end', () => cb(null, Buffer.concat(morceaux).toString('utf8')));
});

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
});
afterAll(fermer);

describe('Export CSV', () => {
  beforeAll(async () => {
    const cat = (await api().post('/api/categories').set(avec(admin.token)).send({ nom: 'Informatique' })).body;
    await creerProduit(admin.token, { nom: 'Clavier "pro"; sans fil', description: 'Ligne 1\nLigne 2', prix: 45.5, stock: 10, category_id: cat.id });
    const piege = await creerProduit(admin.token, { nom: '=HYPERLINK("http://evil.tn","clic")', prix: 5, stock: 3 });
    await creerProduit(admin.token, { nom: '+33 injection', prix: 1, stock: 1 });
    await creerProduit(admin.token, { nom: '@SUM(A1)', prix: 1, stock: 1 });
    await creerProduit(admin.token, { nom: '-2+3', prix: 1, stock: 1 });
    await api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: piege, quantite: 1 }], adresse_livraison: '=cmd|calc', ville: 'Mahdia' });
  });

  test('401 sans token, 403 pour un client, sur les 3 exports', async () => {
    for (const nom of ['produits', 'commandes', 'mouvements']) {
      expect((await api().get(`/api/export/${nom}`)).status).toBe(401);
      expect((await api().get(`/api/export/${nom}`).set(avec(client.token))).status).toBe(403);
    }
  });

  test('en-têtes : text/csv UTF-8, téléchargement, BOM pour Excel, séparateur ;', async () => {
    const res = await telecharger(admin.token, '/api/export/produits');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv; charset=utf-8/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="produits.csv"');
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(res.body.split('\r\n')[0].replace('﻿', '')).toBe('id;nom;description;prix;stock;seuil_alerte;categorie;note_moyenne');
  });

  test('guillemets, point-virgule et retours à la ligne sont protégés', async () => {
    const { body } = await telecharger(admin.token, '/api/export/produits');
    expect(body).toContain('"Clavier ""pro""; sans fil";"Ligne 1\nLigne 2";45.5;10;5;Informatique');
  });

  test('aucune cellule texte ne commence par = + - @ (injection de formules neutralisée)', async () => {
    const { body } = await telecharger(admin.token, '/api/export/produits');
    expect(body).toContain(`'=HYPERLINK`);
    expect(body).toContain(`'+33 injection`);
    expect(body).toContain(`'@SUM(A1)`);
    expect(body).toContain(`'-2+3`);
    expect(body).not.toMatch(/(^|;|\r\n)"?[=+@]/);

    const commandes = (await telecharger(admin.token, '/api/export/commandes')).body;
    expect(commandes).toContain(`'=cmd|calc`);
    expect(commandes).toContain('Mahdia');
  });

  test('mouvements : les quantités négatives (nombres) restent des nombres', async () => {
    const { body } = await telecharger(admin.token, '/api/export/mouvements');
    const lignes = body.split('\r\n');
    expect(lignes[0].replace('﻿', '')).toBe('id;date;produit;type;quantite;stock_apres;motif;utilisateur');
    const vente = lignes.find((l) => l.includes(';vente;'));
    expect(vente).toMatch(/;vente;-1;/);
    expect(vente).toContain('Commande n°');
  });
});

describe('Import de produits', () => {
  const importer = (token, produits) => api().post('/api/produits/import').set(avec(token)).send({ produits });

  test('401 sans token, 403 pour un client', async () => {
    expect((await api().post('/api/produits/import').send({ produits: [] })).status).toBe(401);
    expect((await importer(client.token, [{ nom: 'A', prix: 1 }])).status).toBe(403);
  });

  test('400 : corps sans tableau, tableau vide, plus de 500 lignes', async () => {
    expect((await api().post('/api/produits/import').set(avec(admin.token)).send({})).status).toBe(400);
    expect((await importer(admin.token, [])).status).toBe(400);
    const trop = Array.from({ length: 501 }, (_, i) => ({ nom: `P${i}`, prix: 1 }));
    const res = await importer(admin.token, trop);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/500/);
  });

  test('import partiel : lignes valides importées, invalides et doublons signalés avec leur numéro', async () => {
    const res = await importer(admin.token, [
      { nom: 'Écran 24"', prix: '199.9', stock: '8', seuil_alerte: 2, categorie: 'Informatique' }, // 1 : catégorie existante
      { nom: 'Casque', description: 'Audio', prix: 59, stock: 5, categorie: 'Audio' },              // 2 : nouvelle catégorie
      { nom: '', prix: 5 },                                                                       // 3 : nom vide
      { nom: 'Câble', prix: 'cher' },                                                              // 4 : prix invalide
      { nom: 'Clavier "pro"; sans fil', prix: 10 },                                                // 5 : existe déjà
      { nom: 'Casque', prix: 60 },                                                                 // 6 : doublon dans le fichier
      { nom: 'Webcam', prix: 80, categorie: 'audio' },                                             // 7 : catégorie retrouvée sans tenir compte de la casse
      { nom: 'Stylet', prix: 5, stock: -4 },                                                       // 8 : stock négatif
      'pas un objet',                                                                              // 9
    ]);
    expect(res.status).toBe(200);
    expect(res.body.importes).toBe(3);
    expect(res.body.ignores).toBe(6);
    expect(res.body.erreurs.map((e) => e.ligne)).toEqual([3, 4, 5, 6, 8, 9]);
    expect(res.body.erreurs.find((e) => e.ligne === 5).message).toMatch(/existe déjà/);
    expect(res.body.erreurs.find((e) => e.ligne === 6).message).toMatch(/existe déjà/);

    const produits = (await api().get('/api/produits')).body;
    const ecran = produits.find((p) => p.nom === 'Écran 24"');
    expect(ecran).toMatchObject({ prix: 199.9, stock: 8, seuil_alerte: 2, categorie_nom: 'Informatique' });
    expect(produits.find((p) => p.nom === 'Casque').categorie_nom).toBe('Audio');
    expect(produits.find((p) => p.nom === 'Webcam').categorie_nom).toBe('Audio');
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM categories WHERE nom IN ('Audio', 'audio')");
    expect(n).toBe(1); // pas de doublon de catégorie

    // chaque produit importé avec du stock a son mouvement "initial"
    const [mvts] = await pool.query("SELECT quantite FROM mouvements_stock WHERE motif = 'Import CSV' ORDER BY id");
    expect(mvts.map((m) => m.quantite)).toEqual([8, 5]);
  });

  test('import de 500 lignes accepté (corps plus gros que la limite habituelle de 100 ko)', async () => {
    const lignes = Array.from({ length: 500 }, (_, i) => ({ nom: `Produit import ${i}`, description: 'd'.repeat(300), prix: 1 + i, stock: 1 }));
    const res = await importer(admin.token, lignes);
    expect(res.status).toBe(200);
    expect(res.body.importes).toBe(500);
  });
});
