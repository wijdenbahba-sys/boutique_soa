const { z } = require('zod');
const { entier, decimal, texte, texteOptionnel, email, idOptionnel } = require('./commun');
const { luhnValide } = require('../services/paiement');

// Code promo saisi par le client : insensible à la casse, "" ou absent = pas de code
const codeFacultatif = z
  .string()
  .trim()
  .toUpperCase()
  .max(40, 'Le code promo ne doit pas dépasser 40 caractères')
  .nullish()
  .transform((v) => (v ? v : null));

const booleen = z.preprocess(
  (v) => (v === 1 || v === '1' || v === 'true' ? true : v === 0 || v === '0' || v === 'false' ? false : v),
  z.boolean({ error: 'Valeur invalide (true ou false attendu)' })
);

const register = z.object({
  nom: texte('Le nom', 100),
  email,
  // bcrypt ne lit que les 72 premiers caractères : on limite pour éviter les surprises
  mot_de_passe: z
    .string({ error: 'Le mot de passe est obligatoire' })
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
    .max(72, 'Le mot de passe ne doit pas dépasser 72 caractères'),
});

const login = z.object({
  email,
  mot_de_passe: z.string({ error: 'Le mot de passe est obligatoire' }).min(1, 'Le mot de passe est obligatoire'),
});

const categorie = z.object({
  nom: texte('Le nom', 100),
  description: texteOptionnel('La description', 2000),
});

const produit = z.object({
  nom: texte('Le nom', 150),
  description: texteOptionnel('La description', 2000),
  prix: decimal('Le prix'),
  stock: entier("Le stock").default(0),
  seuil_alerte: entier("Le seuil d'alerte").default(5),
  image_url: texteOptionnel("L'image", 255),
  category_id: idOptionnel,
});

const ajustementStock = z.object({
  ajustement: entier("L'ajustement", { min: -1000000 }).refine((v) => v !== 0, {
    message: 'ajustement doit être un entier différent de 0 (ex : 10 ou -3)',
  }),
  motif: texteOptionnel('Le motif', 255),
});

// Carte bancaire (paiement simulé) : espaces et tirets tolérés dans le numéro, expiration MM/AA, CVC de 3 ou 4 chiffres
const carte = z.object({
  numero: z
    .string({ error: 'Le numéro de carte est obligatoire' })
    .transform((v) => v.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{12,19}$/, 'Le numéro de carte doit contenir entre 12 et 19 chiffres'))
    .refine(luhnValide, 'Le numéro de carte est invalide'),
  expiration: z
    .string({ error: "La date d'expiration est obligatoire" })
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "La date d'expiration doit être au format MM/AA")
    .refine((v) => {
      const [mois, annee] = v.split('/').map(Number);
      const maintenant = new Date();
      const a = 2000 + annee;
      const m = maintenant.getUTCFullYear() * 12 + maintenant.getUTCMonth();
      return a * 12 + (mois - 1) >= m;
    }, 'La carte est expirée'),
  cvc: z
    .string({ error: 'Le CVC est obligatoire' })
    .trim()
    .regex(/^\d{3,4}$/, 'Le CVC doit contenir 3 ou 4 chiffres'),
  titulaire: texte('Le titulaire de la carte', 100),
}, { error: 'Les informations de la carte sont obligatoires pour un paiement par carte' });

const commande = z.object({
  produits: z
    .array(
      z.object({
        produit_id: entier('produit_id', { min: 1 }),
        quantite: entier('quantite', { min: 1 }),
      }),
      { error: 'La commande doit contenir au moins un produit' }
    )
    .min(1, 'La commande doit contenir au moins un produit'),
  code_promo: codeFacultatif,
  adresse_livraison: texteOptionnel("L'adresse de livraison", 255),
  ville: texteOptionnel('La ville', 80),
  telephone: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.string().regex(/^[0-9+()\s.-]{6,30}$/, "Le numéro de téléphone n'est pas valide").nullable()),
  mode_paiement: z
    .enum(['livraison', 'carte'], { error: 'Le mode de paiement doit être "livraison" ou "carte"' })
    .default('livraison'),
  carte: z.any().optional(),
}).superRefine((c, ctx) => {
  if (c.mode_paiement !== 'carte') return;
  const analyse = carte.safeParse(c.carte ?? undefined);
  if (!analyse.success) {
    for (const i of analyse.error.issues) ctx.addIssue({ code: 'custom', path: ['carte', ...i.path], message: i.message });
  }
}).transform((c) => ({
  ...c,
  // Les données de carte ne sont conservées que pour un paiement par carte (jamais ailleurs)
  carte: c.mode_paiement === 'carte' ? carte.parse(c.carte) : undefined,
}));

const statutCommande = z.object({
  statut: z.string({ error: 'Le statut est obligatoire' }),
});

const fournisseur = z.object({
  nom: texte('Le nom', 150),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.email({ error: "L'email n'est pas valide" }).nullable()),
  telephone: texteOptionnel('Le téléphone', 40),
  adresse: texteOptionnel("L'adresse", 255),
});

const achat = z.object({
  fournisseur_id: entier('fournisseur_id', { min: 1 }),
  lignes: z
    .array(
      z.object({
        produit_id: entier('produit_id', { min: 1 }),
        quantite: entier('quantite', { min: 1 }),
        cout_unitaire: decimal('Le coût unitaire'),
      }),
      { error: "L'achat doit contenir au moins une ligne" }
    )
    .min(1, "L'achat doit contenir au moins une ligne"),
});

const profil = z.object({
  nom: texte('Le nom', 100),
  email,
});

const motDePasse = z.object({
  ancien: z.string({ error: "L'ancien mot de passe est obligatoire" }).min(1, "L'ancien mot de passe est obligatoire"),
  nouveau: z
    .string({ error: 'Le nouveau mot de passe est obligatoire' })
    .min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères')
    .max(72, 'Le nouveau mot de passe ne doit pas dépasser 72 caractères'),
});

const avis = z.object({
  note: entier('La note', { min: -1000000 }).pipe(
    z.number().min(1, 'La note doit être comprise entre 1 et 5').max(5, 'La note doit être comprise entre 1 et 5')
  ),
  commentaire: texteOptionnel('Le commentaire', 2000),
});

const dateAAAAMMJJ = z.preprocess(
  (v) => (v === '' ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date doit être au format AAAA-MM-JJ')
    .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), 'La date est invalide')
    .nullish()
    .transform((v) => (v ? v : null))
);

const codePromo = z
  .object({
    code: z
      .string({ error: 'Le code est obligatoire' })
      .trim()
      .toUpperCase()
      .min(1, 'Le code est obligatoire')
      .max(40, 'Le code ne doit pas dépasser 40 caractères')
      .regex(/^[A-Z0-9_-]+$/, 'Le code ne peut contenir que des lettres, chiffres, tirets et underscores'),
    type: z.enum(['pourcentage', 'montant'], { error: 'Le type doit être "pourcentage" ou "montant"' }),
    valeur: decimal('La valeur').refine((v) => v > 0, 'La valeur doit être supérieure à 0'),
    min_commande: decimal('Le minimum de commande').default(0),
    date_expiration: dateAAAAMMJJ,
    utilisations_max: z.preprocess(
      (v) => (v === '' ? null : v),
      entier("Le nombre d'utilisations", { min: 1 }).nullish().transform((v) => v ?? null)
    ),
    actif: booleen.default(true),
  })
  .refine((c) => c.type !== 'pourcentage' || c.valeur <= 100, {
    path: ['valeur'],
    message: 'Un pourcentage ne peut pas dépasser 100',
  });

const verifierPromo = z.object({
  code: z
    .string({ error: 'Le code est obligatoire' })
    .trim()
    .toUpperCase()
    .min(1, 'Le code est obligatoire')
    .max(40, 'Le code ne doit pas dépasser 40 caractères'),
  montant: decimal('Le montant'),
});

// Import en masse : l'enveloppe est validée ici, chaque ligne est validée une par une dans le controller
// (une ligne invalide est signalée sans bloquer les autres).
const importProduits = z.object({
  produits: z
    .array(z.any(), { error: 'Le champ "produits" doit être un tableau' })
    .min(1, 'Aucun produit à importer')
    .max(500, 'Maximum 500 produits par import'),
});

const ligneImport = z.object({
  nom: texte('Le nom', 150),
  description: texteOptionnel('La description', 2000),
  prix: decimal('Le prix'),
  stock: z.preprocess((v) => (v === '' || v === null ? undefined : v), entier('Le stock').default(0)),
  seuil_alerte: z.preprocess((v) => (v === '' || v === null ? undefined : v), entier("Le seuil d'alerte").default(5)),
  categorie: texteOptionnel('La catégorie', 100),
});


// ---------------- v4 : clés API, webhooks, audit, emails ----------------
const EVENEMENTS_VALIDES = ['commande.creee', 'commande.statut', 'commande.annulee', 'stock.bas', 'achat.recu', 'avis.cree'];

const cleApi = z.object({
  nom: texte('Le nom de la clé', 100),
});

const cleApiMaj = z.object({
  actif: booleen,
});

const evenementsWebhook = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((e) => e.trim()).filter(Boolean) : v),
  z
    .array(z.string(), { error: 'Les événements doivent être une liste (ou "*" pour tous)' })
    .min(1, 'Choisissez au moins un événement')
    .refine((l) => l.every((e) => e === '*' || EVENEMENTS_VALIDES.includes(e)), {
      message: `Événement inconnu. Valeurs possibles : * ou ${EVENEMENTS_VALIDES.join(', ')}`,
    })
    .transform((l) => (l.includes('*') ? ['*'] : [...new Set(l)]))
);

const urlWebhook = z
  .string({ error: "L'URL est obligatoire" })
  .trim()
  .min(1, "L'URL est obligatoire")
  .max(500, "L'URL ne doit pas dépasser 500 caractères")
  .refine((u) => {
    try {
      const x = new URL(u);
      return x.protocol === 'http:' || x.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }, "L'URL n'est pas valide (http ou https uniquement)");

const webhook = z.object({
  url: urlWebhook,
  evenements: evenementsWebhook,
  actif: booleen.default(true),
});

const filtresAudit = z.object({
  entite: z.string().trim().max(40).optional(),
  action: z.string().trim().max(60).optional(),
  user_id: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number({ error: 'user_id doit être un nombre' }).int().positive('user_id invalide').optional()),
  du: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La date "du" doit être au format AAAA-MM-JJ').optional()),
  au: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La date "au" doit être au format AAAA-MM-JJ').optional()),
  search: z.string().trim().max(100).optional(),
}).passthrough();

module.exports = {
  register, login, categorie, produit, ajustementStock, commande, statutCommande, fournisseur, achat,
  profil, motDePasse, avis, codePromo, verifierPromo, importProduits, ligneImport,
  carte, cleApi, cleApiMaj, webhook, filtresAudit, EVENEMENTS_VALIDES,
};
