const fs = require('fs');
const path = require('path');
const { api, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

let admin;
let client;
let produit;

// Vrais en-têtes de fichiers : le serveur lit les premiers octets, pas le type annoncé
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(32)]);

const envoyer = (token, id, buffer, nom = 'photo.png', type = 'image/png') =>
  api().post(`/api/produits/${id}/image`).set(avec(token)).attach('image', buffer, { filename: nom, contentType: type });
const fichiers = () => fs.readdirSync(process.env.UPLOAD_DIR);

beforeAll(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
  produit = await creerProduit(admin.token, { nom: 'Clavier' });
});
afterAll(fermer);

describe('Images des produits', () => {
  test('401 sans token, 403 pour un client', async () => {
    expect((await api().post(`/api/produits/${produit}/image`)).status).toBe(401);
    expect((await envoyer(client.token, produit, PNG)).status).toBe(403);
    expect((await api().delete(`/api/produits/${produit}/image`).set(avec(client.token))).status).toBe(403);
  });

  test('400 : aucun fichier ; type non supporté ; faux PNG (extension trompeuse) ; fichier texte', async () => {
    expect((await api().post(`/api/produits/${produit}/image`).set(avec(admin.token))).status).toBe(400);
    const gif = await envoyer(admin.token, produit, Buffer.from('GIF89a' + 'x'.repeat(50)), 'a.gif', 'image/gif');
    expect(gif.status).toBe(400);
    expect(gif.body.message).toMatch(/JPEG, PNG ou WebP/);
    expect((await envoyer(admin.token, produit, Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png')).status).toBe(400);
    expect((await envoyer(admin.token, produit, Buffer.from('juste du texte'), 'note.txt', 'text/plain')).status).toBe(400);
    expect(fichiers()).toEqual([]); // rien n'a été écrit sur le disque
  });

  test('413 si le fichier dépasse 2 Mo', async () => {
    const trop = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 10)]);
    const res = await envoyer(admin.token, produit, trop);
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/2 Mo/);
    expect(fichiers()).toEqual([]);
  });

  test('404 si le produit n\'existe pas (et rien n\'est enregistré)', async () => {
    expect((await envoyer(admin.token, 99999, PNG)).status).toBe(404);
    expect(fichiers()).toEqual([]);
  });

  test('envoi OK : nom aléatoire, image_url dans le produit, fichier servi sur /uploads', async () => {
    const res = await envoyer(admin.token, produit, PNG);
    expect(res.status).toBe(200);
    expect(res.body.image_url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);

    expect((await api().get(`/api/produits/${produit}`)).body.image_url).toBe(res.body.image_url);
    expect((await api().get('/api/produits')).body[0].image_url).toBe(res.body.image_url);

    const fichier = await api().get(res.body.image_url);
    expect(fichier.status).toBe(200);
    expect(fichier.headers['content-type']).toMatch(/image\/png/);
    expect(fichier.headers['x-content-type-options']).toBe('nosniff');
    expect(fichier.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  test('remplacer l\'image supprime l\'ancien fichier ; JPEG et WebP acceptés', async () => {
    const avant = fichiers();
    expect(avant).toHaveLength(1);
    const jpg = await envoyer(admin.token, produit, JPG, 'p.jpg', 'image/jpeg');
    expect(jpg.body.image_url).toMatch(/\.jpg$/);
    expect(fichiers()).toEqual([path.basename(jpg.body.image_url)]);
    const webp = await envoyer(admin.token, produit, WEBP, 'p.webp', 'image/webp');
    expect(webp.body.image_url).toMatch(/\.webp$/);
    expect(fichiers()).toEqual([path.basename(webp.body.image_url)]);
  });

  test('modifier la fiche produit (PUT sans image_url) conserve l\'image', async () => {
    const avant = (await api().get(`/api/produits/${produit}`)).body;
    const res = await api().put(`/api/produits/${produit}`).set(avec(admin.token))
      .send({ nom: 'Clavier v2', prix: 12, stock: avant.stock, seuil_alerte: 5 });
    expect(res.status).toBe(200);
    expect((await api().get(`/api/produits/${produit}`)).body.image_url).toBe(avant.image_url);
  });

  test('DELETE image : image_url repasse à null, fichier supprimé ; 404 produit inconnu', async () => {
    expect((await api().delete(`/api/produits/${produit}/image`).set(avec(admin.token))).status).toBe(200);
    expect((await api().get(`/api/produits/${produit}`)).body.image_url).toBeNull();
    expect(fichiers()).toEqual([]);
    expect((await api().delete('/api/produits/99999/image').set(avec(admin.token))).status).toBe(404);
  });

  test('supprimer un produit supprime aussi son image', async () => {
    const p = await creerProduit(admin.token, { nom: 'Éphémère' });
    await envoyer(admin.token, p, PNG);
    expect(fichiers()).toHaveLength(1);
    await api().delete(`/api/produits/${p}`).set(avec(admin.token));
    expect(fichiers()).toEqual([]);
  });

  test('on ne peut pas sortir du dossier d\'uploads', async () => {
    const res = await api().get('/uploads/..%2f..%2fpackage.json');
    expect([400, 403, 404]).toContain(res.status);
  });
});
