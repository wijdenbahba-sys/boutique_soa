// Fournisseur de paiement SIMULÉ (aucun vrai débit). Le numéro de carte et le CVC ne sont jamais stockés ni journalisés :
// seuls la marque, les 4 derniers chiffres et une référence sont conservés.
const crypto = require('crypto');

const CARTES_TEST = {
  '4242424242424242': { succes: true, marque: 'Visa' },
  '5555555555554444': { succes: true, marque: 'Mastercard' },
  '4000000000000002': { succes: false, message: 'Carte refusée' },
  '4000000000009995': { succes: false, message: 'Fonds insuffisants' },
};

// Algorithme de Luhn : vérifie la clé de contrôle d'un numéro de carte
function luhnValide(numero) {
  if (!/^\d{12,19}$/.test(numero)) return false;
  let somme = 0;
  let double = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let n = Number(numero[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
    double = !double;
  }
  return somme % 10 === 0;
}

function marque(numero) {
  if (/^4/.test(numero)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(numero)) return 'Mastercard';
  if (/^3[47]/.test(numero)) return 'Amex';
  return 'Carte';
}

function genererReference() {
  return 'PAY-' + crypto.randomBytes(8).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10).padEnd(10, '0');
}

// carte : { numero, expiration, cvc, titulaire } déjà validé. Retourne :
//   { succes: true, marque, last4, reference }  ou  { succes: false, message }
async function autoriser(carte, montant) {
  const numero = String(carte.numero).replace(/[\s-]/g, '');
  const connue = CARTES_TEST[numero];
  if (connue && !connue.succes) {
    return { succes: false, message: connue.message };
  }
  if (!(montant >= 0)) {
    return { succes: false, message: 'Montant invalide' };
  }
  return {
    succes: true,
    marque: connue ? connue.marque : marque(numero),
    last4: numero.slice(-4),
    reference: genererReference(),
  };
}

module.exports = { autoriser, luhnValide, marque, CARTES_TEST };
