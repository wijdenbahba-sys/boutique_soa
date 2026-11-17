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
    version: '2.0.0',
    description:
      "API REST de gestion d'inventaire de produits pour une boutique en ligne (mini-projet atelier SOA).\n\n" +
      '**Comment tester les routes protégées :**\n' +
      '1. Appeler `POST /api/auth/login` et copier le `token` de la réponse.\n' +
      '2. Cliquer sur le bouton **Authorize** (en haut à droite) et coller le token.\n' +
      '3. Les cadenas se ferment : toutes les routes protégées sont maintenant utilisables.\n\n' +
      '**Rôles :** `client` (passe des commandes) et `admin` (gère produits, stock, commandes, fournisseurs et achats).\n\n' +
      '**Sécurité :** JWT, mots de passe hachés (bcrypt), validation des entrées, en-têtes helmet, limitation de débit ' +
      '(réponse `429` après trop de requêtes ou de tentatives de connexion).\n\n' +
      '**Pagination :** les listes acceptent `?page=1&limit=10` (réponse `{ data, pagination }`) et un tri `?tri=...&ordre=asc|desc`.',
  },
  servers: [{ url: '/', description: 'Serveur courant' }],
  tags: [
    { name: 'Authentification', description: 'Inscription, connexion, profil' },
    { name: 'Catégories', description: 'Gestion des catégories de produits' },
    { name: 'Produits', description: 'Gestion des produits et du stock' },
    { name: 'Commandes', description: 'Passage et suivi des commandes' },
    { name: 'Statistiques', description: "Tableau de bord de l'administrateur" },
    { name: 'Mouvements de stock', description: 'Historique de tous les changements de stock (traçabilité)' },
    { name: 'Fournisseurs', description: 'Gestion des fournisseurs' },
    { name: 'Achats', description: 'Réapprovisionnement : bons de commande fournisseur, réception = stock +' },
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
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42 },
          pages: { type: 'integer', example: 5 },
        },
      },
      Mouvement: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          produit_id: { type: 'integer', example: 1 },
          produit_nom: { type: 'string', example: 'Clavier sans fil' },
          type: {
            type: 'string',
            enum: ['initial', 'vente', 'annulation', 'ajustement', 'reception', 'modification'],
            example: 'vente',
          },
          quantite: { type: 'integer', description: 'Variation signée (+10 entrée, -3 sortie)', example: -3 },
          stock_apres: { type: 'integer', example: 27 },
          utilisateur_nom: { type: 'string', nullable: true, example: 'Admin' },
          commande_id: { type: 'integer', nullable: true },
          achat_id: { type: 'integer', nullable: true },
          motif: { type: 'string', nullable: true, example: 'Commande n°5' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Fournisseur: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nom: { type: 'string', example: 'TechDistrib Tunisie' },
          email: { type: 'string', nullable: true, example: 'contact@techdistrib.tn' },
          telephone: { type: 'string', nullable: true, example: '71 000 111' },
          adresse: { type: 'string', nullable: true, example: 'Tunis' },
        },
      },
      FournisseurInput: {
        type: 'object',
        required: ['nom'],
        properties: {
          nom: { type: 'string', example: 'TechDistrib Tunisie' },
          email: { type: 'string', example: 'contact@techdistrib.tn' },
          telephone: { type: 'string', example: '71 000 111' },
          adresse: { type: 'string', example: 'Tunis' },
        },
      },
      Achat: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          fournisseur_id: { type: 'integer', example: 1 },
          fournisseur_nom: { type: 'string', example: 'TechDistrib Tunisie' },
          statut: { type: 'string', enum: ['commande', 'recu', 'annule'], example: 'commande' },
          total: { type: 'number', example: 505 },
          date_achat: { type: 'string', format: 'date-time' },
          date_reception: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      AchatInput: {
        type: 'object',
        required: ['fournisseur_id', 'lignes'],
        properties: {
          fournisseur_id: { type: 'integer', example: 1 },
          lignes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['produit_id', 'quantite', 'cout_unitaire'],
              properties: {
                produit_id: { type: 'integer', example: 3 },
                quantite: { type: 'integer', example: 20 },
                cout_unitaire: { type: 'number', example: 60 },
              },
            },
          },
        },
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
          { name: 'alerte', in: 'query', description: 'true : seulement les produits dont le stock est sous le seuil', schema: { type: 'boolean' } },
          { name: 'tri', in: 'query', description: 'Colonne de tri', schema: { type: 'string', enum: ['nom', 'prix', 'stock', 'date'] } },
          { name: 'ordre', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'page', in: 'query', description: 'Active la pagination', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', description: '10 par défaut, 100 maximum', schema: { type: 'integer', example: 10 } },
        ],
        description:
          'Sans `page` ni `limit` : un simple tableau de produits. Avec `page` ou `limit` : `{ data: [...], pagination: {...} }`.',
        responses: {
          200: reponse('Liste des produits (tableau, ou { data, pagination } si paginé)', {
            oneOf: [
              { type: 'array', items: { $ref: '#/components/schemas/Produit' } },
              {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Produit' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            ],
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
              properties: {
                ajustement: { type: 'integer', example: 10 },
                motif: { type: 'string', description: "Raison, conservée dans l'historique", example: 'Inventaire' },
              },
            },
            { ajustement: 10, motif: 'Inventaire' }
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
          { name: 'tri', in: 'query', schema: { type: 'string', enum: ['date', 'total', 'statut', 'id'] } },
          { name: 'ordre', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'page', in: 'query', description: 'Active la pagination', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', example: 10 } },
        ],
        responses: {
          200: reponse('Liste des commandes (tableau, ou { data, pagination } si paginé)', {
            oneOf: [
              { type: 'array', items: { $ref: '#/components/schemas/Commande' } },
              {
                type: 'object',
                properties: {
                  data: { type: 'array', items: { $ref: '#/components/schemas/Commande' } },
                  pagination: { $ref: '#/components/schemas/Pagination' },
                },
              },
            ],
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
              valeur_stock: { type: 'number', description: 'Somme prix x stock' },
              achats_en_cours: { type: 'integer', description: 'Achats fournisseurs pas encore reçus' },
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

    // =====================  FACTURE PDF  =====================
    '/api/commandes/{id}/facture': {
      get: {
        tags: ['Commandes'],
        summary: 'Facture PDF (propriétaire ou admin)',
        description: "Génère la facture au format PDF. Impossible pour une commande annulée.",
        security: securite,
        parameters: [idParam()],
        responses: {
          200: { description: 'Fichier PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          400: erreur('Commande annulée'),
          401: erreur('Token manquant'),
          403: erreur('Ce n\'est pas votre commande'),
          404: erreur('Commande introuvable'),
        },
      },
    },

    // =====================  STATISTIQUES (graphiques)  =====================
    '/api/stats/ventes': {
      get: {
        tags: ['Statistiques'],
        summary: 'Ventes par jour (admin)',
        description: "Une ligne par jour, les jours sans vente valent 0 : prêt pour un graphique. Commandes annulées exclues.",
        security: securite,
        parameters: [
          { name: 'jours', in: 'query', description: 'Période en jours (1 à 365, 30 par défaut)', schema: { type: 'integer', example: 30 } },
        ],
        responses: {
          200: reponse('Ventes par jour', {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-11-08' },
                commandes: { type: 'integer', example: 2 },
                chiffre_affaires: { type: 'number', example: 230.5 },
              },
            },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },
    '/api/stats/par-categorie': {
      get: {
        tags: ['Statistiques'],
        summary: "Chiffre d'affaires par catégorie (admin)",
        security: securite,
        responses: {
          200: reponse('Ventes par catégorie', {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                categorie: { type: 'string', example: 'Informatique' },
                quantite_vendue: { type: 'integer', example: 12 },
                chiffre_affaires: { type: 'number', example: 540 },
              },
            },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },

    // =====================  MOUVEMENTS DE STOCK  =====================
    '/api/mouvements': {
      get: {
        tags: ['Mouvements de stock'],
        summary: 'Historique du stock (admin)',
        description:
          'Chaque vente, annulation, ajustement, réception fournisseur ou modification de fiche laisse une trace : ' +
          'variation, stock après, utilisateur, motif. Toujours paginé.',
        security: securite,
        parameters: [
          { name: 'produit_id', in: 'query', schema: { type: 'integer' } },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: ['initial', 'vente', 'annulation', 'ajustement', 'reception', 'modification'] },
          },
          { name: 'du', in: 'query', description: 'Date de début (AAAA-MM-JJ)', schema: { type: 'string', example: '2026-11-01' } },
          { name: 'au', in: 'query', description: 'Date de fin (AAAA-MM-JJ)', schema: { type: 'string', example: '2026-11-30' } },
          { name: 'page', in: 'query', schema: { type: 'integer', example: 1 } },
          { name: 'limit', in: 'query', description: '20 par défaut', schema: { type: 'integer', example: 20 } },
        ],
        responses: {
          200: reponse('Mouvements, du plus récent au plus ancien', {
            type: 'object',
            properties: {
              data: { type: 'array', items: { $ref: '#/components/schemas/Mouvement' } },
              pagination: { $ref: '#/components/schemas/Pagination' },
            },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },

    // =====================  FOURNISSEURS  =====================
    '/api/fournisseurs': {
      get: {
        tags: ['Fournisseurs'],
        summary: 'Liste des fournisseurs (admin)',
        security: securite,
        responses: {
          200: reponse('Fournisseurs', { type: 'array', items: { $ref: '#/components/schemas/Fournisseur' } }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
      post: {
        tags: ['Fournisseurs'],
        summary: 'Ajouter un fournisseur (admin)',
        security: securite,
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/FournisseurInput' }) },
        responses: {
          201: reponse('Fournisseur créé', { $ref: '#/components/schemas/Fournisseur' }),
          400: erreur('Données invalides'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          409: erreur('Ce fournisseur existe déjà'),
        },
      },
    },
    '/api/fournisseurs/{id}': {
      get: {
        tags: ['Fournisseurs'],
        summary: "Détail d'un fournisseur (admin)",
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Fournisseur', { $ref: '#/components/schemas/Fournisseur' }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Fournisseur introuvable'),
        },
      },
      put: {
        tags: ['Fournisseurs'],
        summary: 'Modifier un fournisseur (admin)',
        security: securite,
        parameters: [idParam()],
        requestBody: { required: true, content: json({ $ref: '#/components/schemas/FournisseurInput' }) },
        responses: {
          200: reponse('Fournisseur modifié', { $ref: '#/components/schemas/Fournisseur' }),
          400: erreur('Données invalides'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Fournisseur introuvable'),
          409: erreur('Ce fournisseur existe déjà'),
        },
      },
      delete: {
        tags: ['Fournisseurs'],
        summary: 'Supprimer un fournisseur (admin)',
        description: 'Refusé (409) si le fournisseur a des achats enregistrés.',
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Fournisseur supprimé', { $ref: '#/components/schemas/Message' }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Fournisseur introuvable'),
          409: erreur('Fournisseur utilisé par des achats'),
        },
      },
    },

    // =====================  ACHATS (réapprovisionnement)  =====================
    '/api/achats': {
      get: {
        tags: ['Achats'],
        summary: 'Liste des achats (admin)',
        security: securite,
        parameters: [
          { name: 'statut', in: 'query', schema: { type: 'string', enum: ['commande', 'recu', 'annule'] } },
        ],
        responses: {
          200: reponse('Achats', { type: 'array', items: { $ref: '#/components/schemas/Achat' } }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
      post: {
        tags: ['Achats'],
        summary: 'Créer un bon de commande fournisseur (admin)',
        description: "Le stock n'augmente qu'à la réception (`PATCH /api/achats/{id}/recevoir`).",
        security: securite,
        requestBody: {
          required: true,
          content: json(
            { $ref: '#/components/schemas/AchatInput' },
            { fournisseur_id: 1, lignes: [{ produit_id: 3, quantite: 20, cout_unitaire: 60 }] }
          ),
        },
        responses: {
          201: reponse('Achat créé', {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              statut: { type: 'string', example: 'commande' },
              total: { type: 'number', example: 1200 },
              message: { type: 'string' },
            },
          }),
          400: erreur('Données invalides'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Fournisseur ou produit introuvable'),
        },
      },
    },
    '/api/achats/suggestions': {
      get: {
        tags: ['Achats'],
        summary: 'Produits à réapprovisionner (admin)',
        description: 'Produits sous leur seuil d\'alerte, avec une quantité conseillée (de quoi remonter à 2 x le seuil).',
        security: securite,
        responses: {
          200: reponse('Suggestions', {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                produit_id: { type: 'integer' },
                nom: { type: 'string', example: 'Écouteurs Bluetooth' },
                stock: { type: 'integer', example: 4 },
                seuil_alerte: { type: 'integer', example: 5 },
                quantite_suggeree: { type: 'integer', example: 6 },
              },
            },
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
        },
      },
    },
    '/api/achats/{id}': {
      get: {
        tags: ['Achats'],
        summary: "Détail d'un achat (admin)",
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Achat avec ses lignes', {
            allOf: [
              { $ref: '#/components/schemas/Achat' },
              {
                type: 'object',
                properties: {
                  lignes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        produit_id: { type: 'integer' },
                        produit_nom: { type: 'string' },
                        quantite: { type: 'integer' },
                        cout_unitaire: { type: 'number' },
                        sous_total: { type: 'number' },
                      },
                    },
                  },
                },
              },
            ],
          }),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Achat introuvable'),
        },
      },
    },
    '/api/achats/{id}/recevoir': {
      patch: {
        tags: ['Achats'],
        summary: 'Réceptionner un achat (admin)',
        description: 'Le stock de chaque produit augmente (transaction) et chaque entrée est tracée dans l\'historique. Une seule réception possible.',
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Achat reçu', { $ref: '#/components/schemas/Message' }),
          400: erreur('Achat déjà reçu ou annulé'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Achat introuvable'),
        },
      },
    },
    '/api/achats/{id}/annuler': {
      patch: {
        tags: ['Achats'],
        summary: 'Annuler un achat (admin)',
        description: "Possible seulement tant que l'achat n'est pas reçu.",
        security: securite,
        parameters: [idParam()],
        responses: {
          200: reponse('Achat annulé', { $ref: '#/components/schemas/Message' }),
          400: erreur('Achat déjà reçu ou annulé'),
          401: erreur('Token manquant'),
          403: erreur('Accès refusé'),
          404: erreur('Achat introuvable'),
        },
      },
    },
  },
};

module.exports = spec;
