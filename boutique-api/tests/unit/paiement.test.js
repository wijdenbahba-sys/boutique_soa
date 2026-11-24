const { luhnValide, marque, autoriser } = require('../../services/paiement');

describe('services/paiement (simulé)', () => {
  test('Luhn : cartes valides / invalides', () => {
    expect(luhnValide('4242424242424242')).toBe(true);
    expect(luhnValide('5555555555554444')).toBe(true);
    expect(luhnValide('4242424242424241')).toBe(false);
    expect(luhnValide('abcd')).toBe(false);
    expect(luhnValide('')).toBe(false);
  });

  test('marque détectée', () => {
    expect(marque('4242424242424242')).toBe('Visa');
    expect(marque('5555555555554444')).toBe('Mastercard');
  });

  test('succès : ne renvoie que marque, last4 et référence (jamais le numéro complet)', async () => {
    const r = await autoriser({ numero: '4242 4242 4242 4242', cvc: '123' }, 50);
    expect(r.succes).toBe(true);
    expect(r.last4).toBe('4242');
    expect(r.reference).toMatch(/^PAY-/);
    expect(JSON.stringify(r)).not.toContain('4242424242424242');
    expect(JSON.stringify(r)).not.toContain('123');
  });

  test('cartes de test refusées', async () => {
    expect((await autoriser({ numero: '4000000000000002' }, 10)).message).toBe('Carte refusée');
    expect((await autoriser({ numero: '4000000000009995' }, 10)).message).toBe('Fonds insuffisants');
  });
});
