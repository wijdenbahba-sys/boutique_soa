# Boutique API — Gestion d'inventaire de produits

Mini-projet de l'atelier SOA : API REST pour une boutique en ligne
(produits, catégories, stock, commandes), sécurisée par JWT.

**Stack** : Node.js · Express · MySQL · JWT · bcryptjs

## 1. Installation

```bash
npm install
```

## 2. Base de données

1. Démarrer MySQL.
2. Importer le fichier `schema.sql` (à la racine du projet) :

```bash
mysql -u root -p < schema.sql
```

## 3. Configuration

Copier `.env.example` en `.env` puis adapter les valeurs :

```bash
cp .env.example .env
```

Variables importantes : `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.

## 4. Créer un compte admin

L'inscription crée toujours un compte **client**. Pour avoir un admin :

```bash
npm run create-admin -- "Admin" admin@boutique.tn motdepasse123
```

## 5. Lancer le serveur

```bash
npm start        # ou : npm run dev (redémarrage automatique)
```

Le serveur démarre sur http://localhost:3000 et affiche `Connexion MySQL OK`.

## Structure du projet

```
boutique-api/
├── server.js                  # point d'entrée
├── config/db.js               # connexion MySQL (pool)
├── middleware/auth.js         # vérification JWT + rôles
├── routes/                    # définition des URLs
├── controllers/               # logique de chaque endpoint
├── scripts/createAdmin.js     # création d'un admin
├── .env.example
└── package.json
```

## Endpoints

L'authentification se fait avec l'en-tête `Authorization: Bearer <token>`
(le token est retourné par `/api/auth/login`).

### Authentification
| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Connecté |

### Catégories
| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/categories` | Public |
| GET | `/api/categories/:id` | Public |
| POST | `/api/categories` | Admin |
| PUT | `/api/categories/:id` | Admin |
| DELETE | `/api/categories/:id` | Admin |

### Produits
| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/produits` (filtres : `?categorie=1&search=clavier`) | Public |
| GET | `/api/produits/alertes` | Admin |
| GET | `/api/produits/:id` | Public |
| POST | `/api/produits` | Admin |
| PUT | `/api/produits/:id` | Admin |
| DELETE | `/api/produits/:id` | Admin |
| PATCH | `/api/produits/:id/stock` | Admin |

### Commandes
| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/commandes` | Client |
| GET | `/api/commandes/mes-commandes` | Client |
| GET | `/api/commandes` (filtre : `?statut=en_attente`) | Admin |
| GET | `/api/commandes/:id` | Propriétaire ou admin |
| PATCH | `/api/commandes/:id/statut` | Admin |
| PATCH | `/api/commandes/:id/annuler` | Propriétaire ou admin |

### Statistiques
| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/stats` | Admin |

## Exemples de requêtes (Postman)

**Inscription**
```
POST /api/auth/register
{ "nom": "Sara", "email": "sara@test.tn", "mot_de_passe": "123456" }
```

**Connexion** → retourne `token`
```
POST /api/auth/login
{ "email": "sara@test.tn", "mot_de_passe": "123456" }
```

**Créer un produit (admin)**
```
POST /api/produits
{ "nom": "Clavier gamer", "prix": 120, "stock": 15, "seuil_alerte": 3, "category_id": 1 }
```

**Ajuster le stock (admin)** — positif pour ajouter, négatif pour retirer
```
PATCH /api/produits/1/stock
{ "ajustement": -2 }
```

**Passer une commande (client)**
```
POST /api/commandes
{ "produits": [ { "produit_id": 1, "quantite": 2 }, { "produit_id": 3, "quantite": 1 } ] }
```

**Changer le statut (admin)** : `en_attente`, `confirmee`, `expediee`, `livree`
```
PATCH /api/commandes/1/statut
{ "statut": "confirmee" }
```

## Règles métier

- À la création d'une commande, le stock est vérifié puis diminué dans une
  **transaction MySQL** : si un produit manque de stock, rien n'est enregistré.
- Le prix est copié dans `lignes_commande.prix_unitaire` : un changement de prix
  ultérieur ne modifie pas les anciennes commandes.
- Annuler une commande (statut `en_attente` ou `confirmee`) remet les quantités en stock.
- Un produit présent dans une commande ne peut pas être supprimé (erreur 409).
- `GET /api/produits/alertes` liste les produits dont `stock <= seuil_alerte`.

## Codes de réponse

`200` OK · `201` créé · `400` données invalides · `401` non connecté ·
`403` accès refusé · `404` introuvable · `409` conflit · `500` erreur serveur
