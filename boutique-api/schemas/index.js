const { z } = require('zod');
const { entier, decimal, texte, texteOptionnel, email, idOptionnel } = require('./commun');

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
});

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

module.exports = {
  register, login, categorie, produit, ajustementStock, commande, statutCommande, fournisseur, achat,
};
