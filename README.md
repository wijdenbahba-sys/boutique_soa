# Boutique : service web de gestion d'inventaire

Mini-projet **Atelier SOA** (ISET Mahdia), sujet 4 : service web de gestion d'inventaire pour une boutique en ligne.

Le projet est composé de deux parties :

| Dossier | Rôle | Technologies |
|---|---|---|
| [`boutique-api`](./boutique-api) | Service web REST (backend) | Node.js, Express, MySQL, JWT, bcrypt, Swagger |
| [`boutique-frontend`](./boutique-frontend) | Application web (client + administration) | React 18, Vite, React Router |

## Architecture

```
Navigateur (React)  ──HTTP/JSON──▶  API REST (Express)  ──SQL──▶  MySQL
   :5173                               :3000                      :3306
```

Côté API, chaque requête traverse les couches suivantes :
`routes → middleware (vérification du token JWT, contrôle du rôle) → controllers → base MySQL`.

## Fonctionnalités

**Client**
- Consulter le catalogue (recherche, filtre par catégorie, badges de stock)
- Créer un compte, se connecter
- Panier, passage de commande, historique et annulation de ses commandes

**Administrateur**
- Tableau de bord : chiffres clés, commandes par statut, produits les plus vendus, alertes de stock
- Produits : ajout, modification, ajustement du stock, suppression
- Commandes : liste, détail, changement de statut, annulation (le stock est remis à jour)
- Catégories : ajout, modification, suppression

**Points techniques**
- Authentification **JWT** (expiration 1 jour) et mots de passe hachés avec **bcrypt**
- Deux rôles : `client` et `admin` (401 = non authentifié, 403 = rôle insuffisant)
- Requêtes SQL **paramétrées** (protection contre l'injection SQL)
- Commandes passées dans une **transaction** (`FOR UPDATE`) : le stock n'est jamais négatif, et tout est annulé si une ligne échoue
- Documentation interactive **Swagger** (OpenAPI 3.0) sur `/api-docs`

## Installation en local

### 1. Base de données
Démarrer MySQL (Laragon ou XAMPP), puis importer le fichier `boutique-api/schema.sql`
(avec HeidiSQL ou phpMyAdmin). Cela crée la base `boutique_db`, les tables et des données de test.

### 2. API
```bash
cd boutique-api
npm install
cp .env.example .env        # puis adapter les valeurs (mot de passe MySQL, JWT_SECRET)
npm run create-admin -- "Admin" admin@boutique.tn motdepasse
npm start
```
L'API écoute sur http://localhost:3000 et la documentation sur http://localhost:3000/api-docs.

### 3. Frontend
```bash
cd boutique-frontend
npm install
npm run dev
```
Ouvrir http://localhost:5173.

## Utiliser Swagger
1. Ouvrir `/api-docs`, exécuter `POST /api/auth/login`.
2. Copier le `token` de la réponse, cliquer sur **Authorize** et le coller.
3. Les routes protégées sont alors utilisables depuis l'interface.

## Déploiement
- API : _à compléter_
- Frontend : _à compléter_

## Auteur
Wejden Bahba, ISET Mahdia.