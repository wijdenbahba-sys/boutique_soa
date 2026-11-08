// Spécification OpenAPI 3.0 de l'API (affichée par Swagger UI sur /api-docs)

// ---- Petits helpers pour éviter de répéter les mêmes blocs ----
const json = (schema, example) => ({
  'application/json': { schema, ...(example ? { example } : {}) },
});

const reponse = (description, schema, example) => ({
  description,
  ...(schema ? { content: json(schema, example) } : {}),
});

const erreur = (description) =>
  reponse(description, { $ref: '#/components/schemas/Message' }, { message: description });

const idParam = (nom = 'id', description = 'Identifiant') => ({
  name: nom,
  in: 'path',
  required: true,
  description,
  schema: { type: 'integer', example: 1 },
});

const securite = [{ bearerAuth: [] }]; // route protégée : nécessite un token JWT

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Boutique API — Gestion d\'inventaire',
    version: '1.0.0',
    description:
      "API REST de gestion d'inventaire de produits pour une boutique en ligne (mini-projet atelier SOA).\n\n" +
      '**Comment tester les routes protégées :**\n' +
      '1. Appeler `POST /api/auth/login` et copier le `token` de la réponse.\n' +
      '2. Cliquer sur le bouton **Authorize** (en haut à droite) et coller le token.\n' +
      '3. Les cadenas se ferment : toutes les routes protégées sont maintenant utilisables.\n\n' +
      '**Rôles :** `client` (passe des commandes) et `admin` (gère produits, stock et commandes).',
  },
  servers: [{ url: '/', description: 'Serveur courant' }],
  tags: [
    { name: 'Authentification', description: 'Inscription, connexion, profil' },
    { name: 'Catégories', description: 'Gestion des catégories de produits' },
    { name: 'Produits', description: 'Gestion des produits et du stock' },
    { name: 'Commandes', description: 'Passage et suivi des commandes' },
    { name: 'Statistiques', description: "Tableau de bord de l'administrateur" },
  ],

  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Message: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nom: { type: 'string', example: 'Sara' },
          email: { type: 'string', example: 'sara@test.tn' },
          role: { type: 'string', enum: ['admin', 'client'], example: 'client' },
        },
      },
      Categorie: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nom: { type: 'string', example: 'Informatique' },
          description: { type: 'string', nullable: true, example: 'Ordinateurs et accessoires' },
        },
      },
      CategorieInput: {
        type: 'object',
        required: ['nom'],
        properties: {
          nom: { type: 'string', example: 'Informatique' },
          description: { type: 'string', example: 'Ordinateurs et accessoires' },
        },
      },
      Produit: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nom: { type: 'string', example: 'Clavier sans fil' },
          description: { type: 'string', nullable: true, example: 'Clavier AZERTY sans fil' },
          prix: { type: 'number', example: 45 },
          stock: { type: 'integer', example: 30 },
          seuil_alerte: { type: 'integer', example: 5 },
          image_url: { type: 'string', nullable: true },
          category_id: { type: 'integer', nullable: true, example: 1 },
          categorie_nom: { type: 'string', nullable: true, example: 'Informatique' },
        },
      },
      ProduitInput: {
        type: 'object',
        required: ['nom', 'prix'],
        properties: {
          nom: { type: 'string', example: 'Clavier gamer' },
          description: { type: 'string', example: 'Clavier mécanique rétroéclairé' },
          prix: { type: 'number', example: 120 },
          stock: { type: 'integer', example: 15 },
          seuil_alerte: { type: 'integer', example: 3 },
          image_url: { type: 'string' },
          category_id: { type: 'integer', example: 1 },
        },
      },
      Commande: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          user_id: { type: 'integer', example: 2 },
          statut: {
            type: 'string',
            enum: ['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'],
            example: 'en_attente',
          },
          total: { type: 'number', example: 115.5 },
          date_commande: { type: 'string', format: 'date-time' },
        },
      },
      LigneCommande: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          produit_id: { type: 'integer', example: 1 },
          produit_nom: { type: 'string', example: 'Clavier sans fil' },
          quantite: { type: 'integer', example: 2 },
          prix_unitaire: { type: 'number', example: 45 },
          sous_total: { type: 'number', example: 90 },
        },
      },
      CommandeDetail: {
        allOf: [
          { $ref: '#/components/schemas/Commande' },
          {
            type: 'object',
            properties: {
              lignes: { type: 'array', items: { $ref: '#/components/schemas/LigneCommande' } },
            },
          },
        ],
      },
      CommandeInput: {
        type: 'object',
        required: ['produits'],
        properties: {
          produits: {
            type: 'array',
            items: {
              type: 'object',
              required: ['produit_id', 'quantite'],
              properties: {
                produit_id: { type: 'integer', example: 1 },
                quantite: { type: 'integer', example: 2 },
              },
            },
          },
        },
      },
    },
  },

  paths: {
    // =====================  AUTHENTIFICATION  =====================
    '/api/auth/register': {
      post: {
        tags: ['Authentification'],
        summary: 'Créer un compte client',
        description: "Le rôle est toujours `client`. Un admin se crée avec `npm run create-admin`.",
        requestBody: {
          required: true,
          content: json(
            {
              type: 'object',
              required: ['nom', 'email', 'mot_de_passe'],
              properties: {
                nom: { type: 'string' },
                email: { type: 'string' },
                mot_de_passe: { type: 'string', description: '6 caractères minimum' },
              },
            },
            { nom: 'Sara', email: 'sara@test.tn', mot_de_passe: '123456' }
          ),
        },
        responses: {
          201: reponse('Compte créé', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              user: { $ref: '#/components/schemas/User' },
            },
          }),
          400: erreur('Données invalides'),
          409: erreur('Cet email est déjà utilisé'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentification'],
        summary: 'Se connecter (retourne un token JWT)',
        requestBody: {
          required: true,
          content: json(
            {
              type: 'object',
              required: ['email', 'mot_de_passe'],
              properties: { email: { type: 'string' }, mot_de_passe: { type: 'string' } },
            },
            { email: 'admin@boutique.tn', mot_de_passe: 'motdepasse123' }
          ),
        },
        responses: {
          200: reponse('Connexion réussie', {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'À envoyer dans Authorization: Bearer <token>' },
              user: { $ref: '#/components/schemas/User' },
            },
          }),
          400: erreur('Champs manquants'),
          401: erreur('Email ou mot de passe incorrect'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentification'],
        summary: "Infos de l'utilisateur connecté",
        security: securite,
        responses: {
          200: reponse('Utilisateur connecté', { $ref: '#/components/schemas/User' }),
          401: erreur('Token manquant'),
        },
      },
    },

    // =====================  CATÉGORIES  =====================
    '/api/categories': {
      get: {
        tags: ['Catégories'],
        summary: 'Liste des catégories',
        responses: {
          200: reponse('Liste des catégories', {
            type: 'array',
            items: { $ref: '#/components/schemas/Categorie' },
          }),
        },
      },
      post: {
        tags: ['Catégories'],
        summary: 'Ajouter une catégorie (admin)',
        security: securite,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/CategorieInput' }),
        },
        responses: {
          201: reponse('Catégorie créée', { $ref: '#/components/schemas/Categorie' }),
          400: erreur('Le nom est obligatoire'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          409: erreur('Cette catégorie existe déjà'),
        },
      },
    },
    '/api/categories/{id}': {
      get: {
        tags: ['Catégories'],
        summary: 'Détail d\'une catégorie',
        parameters: [idParam()],
        responses: {
          200: reponse('Catégorie', { $ref: '#/components/schemas/Categorie' }),
          404: erreur('Catégorie introuvable'),
        },
      },
      put: {
        tags: ['Catégories'],
        summary: 'Modifier une catégorie (admin)',
        security: securite,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/CategorieInput' }),
        },
        responses: {
          200: reponse('Catégorie modifiée', { $ref: '#/components/schemas/Categorie' }),
          400: erreur('Le nom est obligatoire'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Catégorie introuvable'),
          409: erreur('Cette catégorie existe déjà'),
        },
      },
      delete: {
        tags: ['Catégories'],
        summary: 'Supprimer une catégorie (admin)',
        description: 'Les produits de cette catégorie sont conservés (leur catégorie devient vide).',
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Catégorie supprimée', { $ref: '#/components/schemas/Message' }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Catégorie introuvable'),
        },
      },
    },

    // =====================  PRODUITS  =====================
    '/api/produits': {
      get: {
        tags: ['Produits'],
        summary: 'Liste des produits (avec filtres)',
        parameters: [
          { name: 'categorie', in: 'query', description: 'Filtrer par id de catégorie', schema: { type: 'integer' } },
          { name: 'search', in: 'query', description: 'Recherche dans le nom et la description', schema: { type: 'string' } },
        ],
        responses: {
          200: reponse('Liste des produits', {
            type: 'array',
            items: { $ref: '#/components/schemas/Produit' },
          }),
        },
      },
      post: {
        tags: ['Produits'],
        summary: 'Ajouter un produit (admin)',
        security: securite,
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ProduitInput' }),
        },
        responses: {
          201: reponse('Produit créé', {
            type: 'object',
            properties: { id: { type: 'integer' }, message: { type: 'string' } },
          }),
          400: erreur('Données invalides'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },
    '/api/produits/alertes': {
      get: {
        tags: ['Produits'],
        summary: 'Produits en alerte de stock (admin)',
        description: 'Retourne les produits dont `stock <= seuil_alerte`.',
        security: securite,
        responses: {
          200: reponse('Produits à réapprovisionner', {
            type: 'array',
            items: { $ref: '#/components/schemas/Produit' },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },
    '/api/produits/{id}': {
      get: {
        tags: ['Produits'],
        summary: "Détail d'un produit",
        parameters: [idParam()],
        responses: {
          200: reponse('Produit', { $ref: '#/components/schemas/Produit' }),
          404: erreur('Produit introuvable'),
        },
      },
      put: {
        tags: ['Produits'],
        summary: 'Modifier un produit (admin)',
        security: securite,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: json({ $ref: '#/components/schemas/ProduitInput' }),
        },
        responses: {
          200: reponse('Produit modifié', { $ref: '#/components/schemas/Message' }),
          400: erreur('Données invalides'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Produit introuvable'),
        },
      },
      delete: {
        tags: ['Produits'],
        summary: 'Supprimer un produit (admin)',
        description: 'Impossible si le produit figure déjà dans une commande (409).',
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Produit supprimé', { $ref: '#/components/schemas/Message' }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Produit introuvable'),
          409: erreur('Ce produit figure dans des commandes'),
        },
      },
    },
    '/api/produits/{id}/stock': {
      patch: {
        tags: ['Produits'],
        summary: 'Ajuster le stock (admin)',
        description: "Valeur positive pour ajouter du stock, négative pour en retirer. Le stock ne peut pas devenir négatif.",
        security: securite,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: json(
            {
              type: 'object',
              required: ['ajustement'],
              properties: { ajustement: { type: 'integer', example: 10 } },
            },
            { ajustement: 10 }
          ),
        },
        responses: {
          200: reponse('Nouveau stock', {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              nom: { type: 'string' },
              stock: { type: 'integer' },
              seuil_alerte: { type: 'integer' },
            },
          }),
          400: erreur('Ajustement invalide ou stock négatif'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Produit introuvable'),
        },
      },
    },

    // =====================  COMMANDES  =====================
    '/api/commandes': {
      post: {
        tags: ['Commandes'],
        summary: 'Passer une commande (client)',
        description:
          'Vérifie le stock, calcule le total et décrémente le stock dans une **transaction MySQL** : ' +
          "si un produit manque de stock, rien n'est enregistré.",
        security: securite,
        requestBody: {
          required: true,
          content: json(
            { $ref: '#/components/schemas/CommandeInput' },
            { produits: [{ produit_id: 1, quantite: 2 }, { produit_id: 2, quantite: 1 }] }
          ),
        },
        responses: {
          201: reponse('Commande créée', {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              statut: { type: 'string', example: 'en_attente' },
              total: { type: 'number', example: 115.5 },
              message: { type: 'string' },
            },
          }),
          400: erreur('Panier vide ou stock insuffisant'),
          401: erreur('Token manquant'),
          403: erreur('Réservé aux clients'),
          404: erreur('Produit introuvable'),
        },
      },
      get: {
        tags: ['Commandes'],
        summary: 'Toutes les commandes (admin)',
        security: securite,
        parameters: [
          {
            name: 'statut',
            in: 'query',
            description: 'Filtrer par statut',
            schema: { type: 'string', enum: ['en_attente', 'confirmee', 'expediee', 'livree', 'annulee'] },
          },
        ],
        responses: {
          200: reponse('Liste des commandes', {
            type: 'array',
            items: { $ref: '#/components/schemas/Commande' },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },
    '/api/commandes/mes-commandes': {
      get: {
        tags: ['Commandes'],
        summary: 'Historique des commandes du client connecté',
        security: securite,
        responses: {
          200: reponse('Mes commandes', {
            type: 'array',
            items: { $ref: '#/components/schemas/Commande' },
          }),
          401: erreur('Token manquant'),
          403: erreur('Réservé aux clients'),
        },
      },
    },
    '/api/commandes/{id}': {
      get: {
        tags: ['Commandes'],
        summary: "Détail d'une commande avec ses lignes",
        description: 'Accessible au propriétaire de la commande ou à un admin.',
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Commande et ses lignes', { $ref: '#/components/schemas/CommandeDetail' }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Commande introuvable'),
        },
      },
    },
    '/api/commandes/{id}/statut': {
      patch: {
        tags: ['Commandes'],
        summary: "Changer le statut d'une commande (admin)",
        security: securite,
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: json(
            {
              type: 'object',
              required: ['statut'],
              properties: {
                statut: { type: 'string', enum: ['en_attente', 'confirmee', 'expediee', 'livree'] },
              },
            },
            { statut: 'confirmee' }
          ),
        },
        responses: {
          200: reponse('Statut modifié', {
            type: 'object',
            properties: { id: { type: 'integer' }, statut: { type: 'string' } },
          }),
          400: erreur('Statut invalide'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Commande introuvable'),
        },
      },
    },
    '/api/commandes/{id}/annuler': {
      patch: {
        tags: ['Commandes'],
        summary: 'Annuler une commande (remet les quantités en stock)',
        description:
          "Possible pour le propriétaire ou un admin, tant que la commande est `en_attente` ou `confirmee`.",
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Commande annulée', {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              statut: { type: 'string', example: 'annulee' },
              message: { type: 'string' },
            },
          }),
          400: erreur("Impossible d'annuler à ce statut"),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Commande introuvable'),
        },
      },
    },

    // =====================  STATISTIQUES  =====================
    '/api/stats': {
      get: {
        tags: ['Statistiques'],
        summary: 'Tableau de bord (admin)',
        security: securite,
        responses: {
          200: reponse('Statistiques', {
            type: 'object',
            properties: {
              total_produits: { type: 'integer' },
              produits_en_alerte: { type: 'integer' },
              total_commandes: { type: 'integer' },
              chiffre_affaires: { type: 'number' },
              commandes_par_statut: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { statut: { type: 'string' }, nombre: { type: 'integer' } },
                },
              },
              top_produits: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    nom: { type: 'string' },
                    quantite_vendue: { type: 'integer' },
                  },
                },
              },
            },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },
  },
};

module.exports = spec;
