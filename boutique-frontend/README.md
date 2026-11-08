# Boutique : interface React

Frontend du mini-projet SOA. Il utilise l'API `boutique-api` (Node.js + Express + MySQL).

**Stack** : React 18 · Vite · React Router

## Prérequis
- Node.js installé
- L'API `boutique-api` démarrée (`npm start` dans son dossier, port 3000)

## Lancer le frontend

```bash
npm install
npm run dev
```

Puis ouvrir **http://localhost:5173**.

Si l'API n'est pas sur `http://localhost:3000`, copier `.env.example` en `.env` et modifier `VITE_API_URL`.

## Fonctionnalités
- Catalogue des produits avec **recherche** et **filtre par catégorie**
- Badges de stock : en stock, stock faible, rupture
- **Inscription** et **connexion** (JWT), session conservée après rechargement
- **Panier** : ajout depuis le catalogue, quantités (plafonnées au stock), total, sauvegarde locale
- **Passage de commande** (`POST /api/commandes`) : si l'utilisateur n'est pas connecté, il est
  envoyé vers la connexion puis revient à son panier
- **Mes commandes** : historique, détail des lignes, annulation (le stock est remis à jour côté serveur)
- Gestion des cas d'erreur : stock insuffisant, session expirée (token JWT valable 1 jour), serveur éteint
- Le compte **admin** n'a ni panier ni commandes (le backend refuse ses commandes) ; il arrive sur l'**administration** (`/admin`)

### Interface d'administration (rôle admin uniquement)
- **Tableau de bord** : chiffres clés, commandes par statut, produits les plus vendus, alertes de stock
- **Produits** : liste, ajout, modification, ajustement rapide du stock, suppression (refusée si le produit est déjà dans une commande)
- **Commandes** : toutes les commandes, détail des lignes, changement de statut, annulation (stock remis à jour)
- **Catégories** : ajout, modification, suppression (refusée si des produits l'utilisent)
- Accès protégé : un client qui tape `/admin` est renvoyé ; une session expirée (401) renvoie vers la connexion

## Structure

```
src/
├── main.jsx              # point d'entrée (Router + AuthProvider)
├── App.jsx               # les routes (URL → page)
├── api.js                # appels HTTP vers le backend (ajoute le token JWT)
├── utils.js              # prix en DT, dates, libellés des statuts
├── AuthContext.jsx       # utilisateur connecté (login, register, logout)
├── CartContext.jsx       # panier (ajouter, quantité, retirer, total)
├── useApi.js             # hook : appel API avec token + gestion de la session expirée
├── components/
│   ├── Navbar.jsx
│   ├── ProduitCard.jsx
│   └── RouteAdmin.jsx    # protège les pages /admin (rôle admin)
├── pages/
│   ├── Catalogue.jsx
│   ├── Panier.jsx
│   ├── MesCommandes.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   └── admin/
│       ├── Dashboard.jsx
│       ├── AdminProduits.jsx
│       ├── ProduitForm.jsx
│       ├── AdminCommandes.jsx
│       └── AdminCategories.jsx
└── styles.css
```

## Compte de test
Client : créer un compte via la page Inscription. Admin : se crée côté backend avec
`npm run create-admin` (par ex. `admin@boutique.tn`).
