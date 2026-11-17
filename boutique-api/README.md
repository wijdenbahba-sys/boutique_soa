# Boutique API : gestion d'inventaire

API REST d'une boutique en ligne (produits, catégories, stock, commandes, fournisseurs, réapprovisionnement), sécurisée par JWT.

**Stack** : Node.js · Express · MySQL · JWT · bcryptjs · zod · helmet · pdfkit · Swagger · Jest/Supertest

## Installation

```bash
npm install
cp .env.example .env      # adapter DB_PASSWORD, JWT_SECRET (obligatoire), CORS_ORIGIN, DB_SSL
```

### Base de données
- **Nouvelle base** : importer `schema.sql` (HeidiSQL, phpMyAdmin ou `mysql -u root -p --default-character-set=utf8mb4 < schema.sql`).
- **Base v1 existante** : exécuter `migration.sql` (idempotent, ajoute les nouvelles tables sans toucher aux données).

### Lancer
```bash
npm run create-admin -- "Admin" admin@boutique.tn motdepasse123
npm start          # ou npm run dev
```
Serveur : http://localhost:3000 · Swagger : http://localhost:3000/api-docs

## Tests

```bash
npm test           # 94 tests (unitaires + intégration API)
npm run test:unit  # unitaires seulement (sans MySQL)
```
Les tests d'intégration ont besoin de MySQL démarré. Ils utilisent une base séparée `boutique_test`, recréée automatiquement : la base `boutique_db` n'est jamais touchée.

## Fonctionnalités v2
- **Pagination, tri, recherche** : `?page=1&limit=10&tri=prix&ordre=desc&search=...` (sans `page`/`limit`, la réponse reste un tableau simple). Réponse paginée : `{ data, pagination: { page, limit, total, pages } }`. Le tri passe par une liste blanche de colonnes.
- **Historique des mouvements de stock** (`mouvements_stock`) : vente, annulation, ajustement, réception, modification. Écrit dans la même transaction que le changement de stock, avec utilisateur, motif et stock après.
- **Fournisseurs et achats** : bon de commande, réception (le stock augmente et un mouvement est créé), suggestions de réapprovisionnement.
- **Statistiques** : chiffres clés, ventes par jour, chiffre d'affaires par catégorie.
- **Facture PDF** : `GET /api/commandes/:id/facture` (propriétaire ou admin).
- **Sécurité** : `helmet`, limitation de débit (300 req/15 min, 10 échecs de login/15 min, 20 inscriptions/h), validation `zod` avec messages en français (400), corps JSON limité à 100 ko, CORS configurable, requêtes SQL paramétrées.

## Documentation
- Swagger : `/api-docs` (37 endpoints, vérifiés contre les vraies routes).
- Postman : importer `docs/boutique-api.postman_collection.json` ; lancer d'abord `POST /api/auth/login`, le token est enregistré automatiquement. Régénérer avec `npm run postman`.

## Structure
```
boutique-api/
├── app.js                 # application Express (importée par les tests)
├── server.js              # démarrage (listen)
├── config/db.js           # pool MySQL (SSL optionnel)
├── middleware/            # auth JWT + rôles, validation zod, limiteurs
├── schemas/               # schémas zod
├── routes/                # URLs
├── controllers/           # logique métier
├── utils/                 # pagination, mouvements de stock
├── docs/                  # swagger.js + collection Postman
├── scripts/               # create-admin, génération Postman
├── tests/                 # unit/ et api/
├── schema.sql · migration.sql
└── Dockerfile
```

## Endpoints
Authentification : en-tête `Authorization: Bearer <token>`. 401 = non authentifié, 403 = rôle insuffisant.

| Méthode | URL | Description |
|---|---|---|
| POST | `/api/auth/register` | Créer un compte client |
| POST | `/api/auth/login` | Se connecter (retourne un token JWT) |
| GET | `/api/auth/me` | Infos de l'utilisateur connecté |
| GET | `/api/categories` | Liste des catégories |
| POST | `/api/categories` | Ajouter une catégorie (admin) |
| GET | `/api/categories/{id}` | Détail d'une catégorie |
| PUT | `/api/categories/{id}` | Modifier une catégorie (admin) |
| DELETE | `/api/categories/{id}` | Supprimer une catégorie (admin) |
| GET | `/api/produits` | Liste des produits (avec filtres) |
| POST | `/api/produits` | Ajouter un produit (admin) |
| GET | `/api/produits/alertes` | Produits en alerte de stock (admin) |
| GET | `/api/produits/{id}` | Détail d'un produit |
| PUT | `/api/produits/{id}` | Modifier un produit (admin) |
| DELETE | `/api/produits/{id}` | Supprimer un produit (admin) |
| PATCH | `/api/produits/{id}/stock` | Ajuster le stock (admin) |
| POST | `/api/commandes` | Passer une commande (client) |
| GET | `/api/commandes` | Toutes les commandes (admin) |
| GET | `/api/commandes/mes-commandes` | Historique des commandes du client connecté |
| GET | `/api/commandes/{id}` | Détail d'une commande avec ses lignes |
| PATCH | `/api/commandes/{id}/statut` | Changer le statut d'une commande (admin) |
| PATCH | `/api/commandes/{id}/annuler` | Annuler une commande (remet les quantités en stock) |
| GET | `/api/stats` | Tableau de bord (admin) |
| GET | `/api/commandes/{id}/facture` | Facture PDF (propriétaire ou admin) |
| GET | `/api/stats/ventes` | Ventes par jour (admin) |
| GET | `/api/stats/par-categorie` | Chiffre d'affaires par catégorie (admin) |
| GET | `/api/mouvements` | Historique du stock (admin) |
| GET | `/api/fournisseurs` | Liste des fournisseurs (admin) |
| POST | `/api/fournisseurs` | Ajouter un fournisseur (admin) |
| GET | `/api/fournisseurs/{id}` | Détail d'un fournisseur (admin) |
| PUT | `/api/fournisseurs/{id}` | Modifier un fournisseur (admin) |
| DELETE | `/api/fournisseurs/{id}` | Supprimer un fournisseur (admin) |
| GET | `/api/achats` | Liste des achats (admin) |
| POST | `/api/achats` | Créer un bon de commande fournisseur (admin) |
| GET | `/api/achats/suggestions` | Produits à réapprovisionner (admin) |
| GET | `/api/achats/{id}` | Détail d'un achat (admin) |
| PATCH | `/api/achats/{id}/recevoir` | Réceptionner un achat (admin) |
| PATCH | `/api/achats/{id}/annuler` | Annuler un achat (admin) |
