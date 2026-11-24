const { versCsv, neutraliser } = require('../../utils/csv');
const { calculerRemise } = require('../../utils/promo');

describe('utils/csv', () => {
  test('neutraliser préfixe uniquement les textes dangereux', () => {
    for (const d of ['=1+1', '+1', '-1', '@a', '\tx', '\rx']) expect(neutraliser(d)).toBe(`'${d}`);
    for (const s of ['Clavier', '1=1', 'a-b', '']) expect(neutraliser(s)).toBe(s);
  });

  test('versCsv : BOM, séparateur ;, CRLF, nulls vides, nombres négatifs intacts, dates ISO', () => {
    const csv = versCsv(
      [{ cle: 'a', titre: 'a' }, { cle: 'b', titre: 'b' }, { cle: 'c', titre: 'c' }],
      [{ a: 'x;y', b: -3, c: null }, { a: '=cmd', b: new Date('2026-01-02T03:04:05Z'), c: 'ok' }]
    );
    expect(csv).toBe('﻿a;b;c\r\n"x;y";-3;\r\n\'=cmd;2026-01-02 03:04:05;ok\r\n');
  });
});

describe('utils/promo (calcul pur, sans base)', () => {
  const faux = (promo) => ({ query: async () => [promo ? [promo] : []] });
  const base = { code: 'X', type: 'pourcentage', valeur: 15, min_commande: 0, actif: 1, expire: 0, utilisations: 0, utilisations_max: null };

  test('arrondi au centime', async () => {
    const r = await calculerRemise(faux(base), 'X', 33.33);
    expect(r).toMatchObject({ remise: 5, total_apres: 28.33 }); // 33.33 x 15 % = 4.9995
  });

  test('refus : inconnu, inactif, expiré, épuisé, minimum', async () => {
    await expect(calculerRemise(faux(null), 'X', 10)).rejects.toMatchObject({ status: 400 });
    await expect(calculerRemise(faux({ ...base, actif: 0 }), 'X', 10)).rejects.toThrow(/actif/);
    await expect(calculerRemise(faux({ ...base, expire: 1 }), 'X', 10)).rejects.toThrow(/expiré/);
    await expect(calculerRemise(faux({ ...base, utilisations: 3, utilisations_max: 3 }), 'X', 10)).rejects.toThrow(/utilisations/);
    await expect(calculerRemise(faux({ ...base, min_commande: 50 }), 'X', 10)).rejects.toThrow(/50\.00 DT/);
  });
});
