const { z } = require('zod');

// Les clients envoient parfois des nombres sous forme de texte ("12.5") : on les convertit.
const versNombre = (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v);

function messageNombre(label) {
  return (iss) => (iss.input === undefined ? `${label} est obligatoire` : `${label} doit être un nombre`);
}

// Entier >= min (par défaut 0). Utilisation : entier('Le stock')
function entier(label, { min = 0 } = {}) {
  return z.preprocess(
    versNombre,
    z.number({ error: messageNombre(label) })
      .int(`${label} doit être un entier`)
      .min(min, `${label} doit être supérieur ou égal à ${min}`)
  );
}

// Nombre décimal >= 0 (prix, coûts)
function decimal(label) {
  return z.preprocess(
    versNombre,
    z.number({ error: messageNombre(label) }).min(0, `${label} doit être supérieur ou égal à 0`)
  );
}

// Texte obligatoire
function texte(label, max = 150) {
  return z
    .string({ error: `${label} est obligatoire` })
    .trim()
    .min(1, `${label} est obligatoire`)
    .max(max, `${label} ne doit pas dépasser ${max} caractères`);
}

// Texte facultatif : "" ou absent devient null
function texteOptionnel(label, max = 255) {
  return z
    .string()
    .trim()
    .max(max, `${label} ne doit pas dépasser ${max} caractères`)
    .nullish()
    .transform((v) => (v ? v : null));
}

const email = z
  .string({ error: "L'email est obligatoire" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "L'email n'est pas valide" }));

// Identifiant optionnel : "" / null / absent devient null
const idOptionnel = z.preprocess(
  (v) => (v === '' || v === undefined ? null : versNombre(v)),
  z.number({ error: 'Identifiant invalide' }).int('Identifiant invalide').positive('Identifiant invalide').nullable()
);

module.exports = { entier, decimal, texte, texteOptionnel, email, idOptionnel };
