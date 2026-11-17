const schemas = require('../../schemas');
const { lirePagination, construireTri, reponsePaginee } = require('../../utils/pagination');

describe('Schémas de validation (zod)', () => {
  test('un produit valide : les nombres écrits en texte sont convertis, les défauts appliqués', () => {
    const r = schemas.produit.safeParse({ nom: '  Clavier ', prix: '45.5' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ nom: 'Clavier', prix: 45.5, stock: 0, seuil_alerte: 5, category_id: null, description: null });
  });

  test('un nom vide est refusé avec un message en français', () => {
    const r = schemas.produit.safeParse({ nom: '   ', prix: 10 });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toBe('Le nom est obligatoire');
  });

  test('prix négatif, prix texte et stock décimal sont refusés', () => {
    expect(schemas.produit.safeParse({ nom: 'A', prix: -1 }).success).toBe(false);
    expect(schemas.produit.safeParse({ nom: 'A', prix: 'abc' }).success).toBe(false);
    expect(schemas.produit.safeParse({ nom: 'A', prix: 1, stock: 2.5 }).success).toBe(false);
  });

  test("l'email est nettoyé (espaces, majuscules) et contrôlé", () => {
    const ok = schemas.login.safeParse({ email: '  Wejden@Gmail.com ', mot_de_passe: 'x' });
    expect(ok.data.email).toBe('wejden@gmail.com');
    expect(schemas.login.safeParse({ email: 'pas-un-email', mot_de_passe: 'x' }).success).toBe(false);
  });

  test("l'inscription exige 6 caractères minimum", () => {
    const r = schemas.register.safeParse({ nom: 'A', email: 'a@b.tn', mot_de_passe: '123' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/6 caractères/);
  });

  test('une commande doit contenir au moins un produit, avec des quantités > 0', () => {
    expect(schemas.commande.safeParse({ produits: [] }).success).toBe(false);
    expect(schemas.commande.safeParse({ produits: [{ produit_id: 1, quantite: 0 }] }).success).toBe(false);
    expect(schemas.commande.safeParse({ produits: [{ produit_id: '1', quantite: '2' }] }).success).toBe(true);
  });

  test("l'ajustement de stock ne peut pas être 0", () => {
    expect(schemas.ajustementStock.safeParse({ ajustement: 0 }).success).toBe(false);
    expect(schemas.ajustementStock.safeParse({ ajustement: -3 }).success).toBe(true);
  });
});

describe('Pagination et tri', () => {
  test('sans page ni limit : pas de pagination (ancien format tableau)', () => {
    expect(lirePagination({}).pagine).toBe(false);
  });

  test('page et limit sont lus, bornés et convertis en offset', () => {
    expect(lirePagination({ page: '3', limit: '10' })).toMatchObject({ pagine: true, page: 3, limit: 10, offset: 20 });
    expect(lirePagination({ page: '-4', limit: '100000' })).toMatchObject({ page: 1, limit: 100, offset: 0 });
    expect(lirePagination({ page: 'abc' }).page).toBe(1);
  });

  test('le tri utilise une liste blanche : une colonne inconnue (injection SQL) est ignorée', () => {
    const colonnes = { nom: 'p.nom', prix: 'p.prix' };
    expect(construireTri({ tri: 'prix', ordre: 'desc' }, colonnes, 'p.nom').sql).toBe('ORDER BY p.prix DESC');
    const piege = construireTri({ tri: 'nom; DROP TABLE produits', ordre: 'asc' }, colonnes, 'p.nom');
    expect(piege.sql).toBe('ORDER BY p.nom ASC');
  });

  test('reponsePaginee calcule le nombre de pages', () => {
    const r = reponsePaginee([1, 2], 25, { page: 1, limit: 10 });
    expect(r.pagination).toEqual({ page: 1, limit: 10, total: 25, pages: 3 });
  });
});
