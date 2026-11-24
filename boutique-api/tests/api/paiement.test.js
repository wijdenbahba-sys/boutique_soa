const { api, pool, reinitialiser, creerAdmin, creerClient, avec, creerProduit, fermer } = require('../helpers');

const carte = (numero = '4242424242424242') => ({ numero, expiration: '12/40', cvc: '123', titulaire: 'Test Client' });
let admin; let client; let pid;

beforeEach(async () => {
  await reinitialiser();
  admin = await creerAdmin();
  client = await creerClient();
  pid = await creerProduit(admin.token, { prix: 20, stock: 10 });
});
afterAll(fermer);

const stock = async () => (await pool.query('SELECT stock FROM produits WHERE id = ?', [pid]))[0][0].stock;
const commander = (corps) => api().post('/api/commandes').set(avec(client.token)).send({ produits: [{ produit_id: pid, quantite: 2 }], ...corps });

describe('Paiement simulé', () => {
  test('livraison par défaut : statut_paiement en_attente', async () => {
    const r = await commander({});
    expect(r.status).toBe(201);
    expect(r.body.mode_paiement).toBe('livraison');
    expect(r.body.statut_paiement).toBe('en_attente');
    expect(r.body.paiement).toBeNull();
  });

  test('carte valide : payé, marque + last4 + référence, aucun numéro en base', async () => {
    const r = await commander({ mode_paiement: 'carte', carte: carte() });
    expect(r.status).toBe(201);
    expect(r.body.statut_paiement).toBe('paye');
    expect(r.body.paiement).toMatchObject({ marque: 'Visa', last4: '4242' });
    const [[c]] = await pool.query('SELECT * FROM commandes WHERE id = ?', [r.body.id]);
    const brut = JSON.stringify(c);
    expect(brut).not.toContain('4242424242424242');
    expect(brut).not.toContain('"123"');
    expect(await stock()).toBe(8);
  });

  test('carte refusée : 402, stock intact, aucune commande', async () => {
    const r = await commander({ mode_paiement: 'carte', carte: carte('4000000000000002') });
    expect(r.status).toBe(402);
    expect(r.body.message).toMatch(/refusé/i);
    expect(await stock()).toBe(10);
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM commandes');
    expect(n).toBe(0);
  });

  test('refus avec code promo : l\'utilisation du code est annulée aussi', async () => {
    await api().post('/api/codes-promo').set(avec(admin.token)).send({ code: 'TEST10', type: 'pourcentage', valeur: 10 });
    const r = await commander({ code_promo: 'TEST10', mode_paiement: 'carte', carte: carte('4000000000009995') });
    expect(r.status).toBe(402);
    const [[p]] = await pool.query("SELECT utilisations FROM codes_promo WHERE code = 'TEST10'");
    expect(p.utilisations).toBe(0);
  });

  test('numéro invalide (Luhn) ou champs manquants : 400', async () => {
    expect((await commander({ mode_paiement: 'carte', carte: carte('4242424242424241') })).status).toBe(400);
    expect((await commander({ mode_paiement: 'carte' })).status).toBe(400);
    expect((await commander({ mode_paiement: 'carte', carte: { ...carte(), cvc: '1' } })).status).toBe(400);
    expect((await commander({ mode_paiement: 'bitcoin' })).status).toBe(400);
  });

  test('annulation d\'une commande payée : remboursée', async () => {
    const r = await commander({ mode_paiement: 'carte', carte: carte() });
    const a = await api().patch(`/api/commandes/${r.body.id}/annuler`).set(avec(client.token));
    expect(a.body.statut_paiement).toBe('rembourse');
    expect(await stock()).toBe(10);
  });

  test('livraison : passe à payé quand la commande est livrée', async () => {
    const r = await commander({});
    const s = await api().patch(`/api/commandes/${r.body.id}/statut`).set(avec(admin.token)).send({ statut: 'livree' });
    expect(s.body.statut_paiement).toBe('paye');
  });

  test('la facture PDF mentionne le paiement (réponse PDF valide)', async () => {
    const r = await commander({ mode_paiement: 'carte', carte: carte() });
    const f = await api().get(`/api/commandes/${r.body.id}/facture`).set(avec(client.token));
    expect(f.status).toBe(200);
    expect(f.headers['content-type']).toMatch(/pdf/);
  });
});
