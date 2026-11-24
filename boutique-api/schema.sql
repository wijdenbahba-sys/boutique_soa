-- ============================================================
-- Mini-projet SOA : Service web de gestion d'inventaire (boutique en ligne)
-- Base de données : MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS boutique_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE boutique_db;

-- Pour pouvoir relancer le script sans erreur
DROP TABLE IF EXISTS emails;
DROP TABLE IF EXISTS journal_audit;
DROP TABLE IF EXISTS webhook_livraisons;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS avis;
DROP TABLE IF EXISTS favoris;
DROP TABLE IF EXISTS codes_promo;
DROP TABLE IF EXISTS achats_lignes;
DROP TABLE IF EXISTS achats;
DROP TABLE IF EXISTS fournisseurs;
DROP TABLE IF EXISTS mouvements_stock;
DROP TABLE IF EXISTS lignes_commande;
DROP TABLE IF EXISTS commandes;
DROP TABLE IF EXISTS produits;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- ------------------------------------------------------------
-- Table : users
-- ------------------------------------------------------------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  mot_de_passe  VARCHAR(255) NOT NULL,              -- haché avec bcrypt
  role          ENUM('admin', 'client') NOT NULL DEFAULT 'client',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : categories
-- ------------------------------------------------------------
CREATE TABLE categories (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL UNIQUE,
  description  TEXT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : produits
-- ------------------------------------------------------------
CREATE TABLE produits (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(150) NOT NULL,
  description   TEXT,
  prix          DECIMAL(10,2) NOT NULL CHECK (prix >= 0),
  stock         INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  seuil_alerte  INT NOT NULL DEFAULT 5,              -- alerte si stock <= seuil
  image_url     VARCHAR(255),
  category_id   INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_produit_categorie
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : commandes
-- ------------------------------------------------------------
CREATE TABLE commandes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  statut         ENUM('en_attente', 'confirmee', 'expediee', 'livree', 'annulee')
                 NOT NULL DEFAULT 'en_attente',
  total          DECIMAL(10,2) NOT NULL DEFAULT 0,       -- total final, après remise éventuelle
  code_promo     VARCHAR(40)   NULL,
  remise         DECIMAL(10,2) NOT NULL DEFAULT 0,
  adresse_livraison VARCHAR(255) NULL,
  ville          VARCHAR(80)   NULL,
  telephone      VARCHAR(30)   NULL,
  mode_paiement  ENUM('livraison', 'carte') NOT NULL DEFAULT 'livraison',
  statut_paiement ENUM('en_attente', 'paye', 'echoue', 'rembourse') NOT NULL DEFAULT 'en_attente',
  paiement_marque     VARCHAR(20) NULL,    -- Visa, Mastercard... (jamais le numéro complet)
  paiement_last4      CHAR(4)     NULL,
  paiement_reference  VARCHAR(40) NULL,
  date_commande  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_commande_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : lignes_commande
-- ------------------------------------------------------------
CREATE TABLE lignes_commande (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  commande_id   INT NOT NULL,
  produit_id    INT NOT NULL,
  quantite      INT NOT NULL CHECK (quantite > 0),
  prix_unitaire DECIMAL(10,2) NOT NULL,              -- prix au moment de la commande
  CONSTRAINT fk_ligne_commande
    FOREIGN KEY (commande_id) REFERENCES commandes(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_ligne_produit
    FOREIGN KEY (produit_id) REFERENCES produits(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : mouvements_stock (historique / traçabilité de chaque changement de stock)
--   quantite    : variation signée (+10 = entrée, -3 = sortie)
--   stock_apres : stock du produit juste après le mouvement
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  produit_id   INT NOT NULL,
  type         ENUM('initial', 'vente', 'annulation', 'ajustement', 'reception', 'modification') NOT NULL,
  quantite     INT NOT NULL,
  stock_apres  INT NOT NULL,
  user_id      INT NULL,
  commande_id  INT NULL,
  achat_id     INT NULL,
  motif        VARCHAR(255) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mvt_produit (produit_id),
  INDEX idx_mvt_date (created_at),
  CONSTRAINT fk_mvt_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
  CONSTRAINT fk_mvt_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : fournisseurs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fournisseurs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(150) NOT NULL UNIQUE,
  email       VARCHAR(150) NULL,
  telephone   VARCHAR(40)  NULL,
  adresse     VARCHAR(255) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : achats (bons de commande envoyés aux fournisseurs)
--   statut : commande → recu (le stock augmente) ou annule
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achats (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  fournisseur_id  INT NOT NULL,
  statut          ENUM('commande', 'recu', 'annule') NOT NULL DEFAULT 'commande',
  total           DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_achat      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_reception  TIMESTAMP NULL,
  user_id         INT NULL,
  CONSTRAINT fk_achat_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE RESTRICT,
  CONSTRAINT fk_achat_user        FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS achats_lignes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  achat_id      INT NOT NULL,
  produit_id    INT NOT NULL,
  quantite      INT NOT NULL CHECK (quantite > 0),
  cout_unitaire DECIMAL(10,2) NOT NULL CHECK (cout_unitaire >= 0),
  CONSTRAINT fk_alig_achat   FOREIGN KEY (achat_id)   REFERENCES achats(id)   ON DELETE CASCADE,
  CONSTRAINT fk_alig_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : favoris (liste de souhaits d'un client)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favoris (
  user_id     INT NOT NULL,
  produit_id  INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, produit_id),
  CONSTRAINT fk_fav_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_fav_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : codes_promo (réductions applicables au panier)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS codes_promo (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(40) NOT NULL UNIQUE,
  type             ENUM('pourcentage', 'montant') NOT NULL,
  valeur           DECIMAL(10,2) NOT NULL,
  min_commande     DECIMAL(10,2) NOT NULL DEFAULT 0,
  date_expiration  DATE NULL,
  utilisations_max INT NULL,
  utilisations     INT NOT NULL DEFAULT 0,
  actif            TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Table : avis (note de 1 à 5 + commentaire, un seul avis par client et par produit)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS avis (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  produit_id   INT NOT NULL,
  user_id      INT NOT NULL,
  note         TINYINT NOT NULL,
  commentaire  TEXT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_avis_produit_user (produit_id, user_id),
  CONSTRAINT fk_avis_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE,
  CONSTRAINT fk_avis_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- v4 : clés API, webhooks, journal d'audit, emails
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  nom                   VARCHAR(100) NOT NULL,
  prefixe               VARCHAR(20)  NOT NULL,              -- début de la clé, pour la reconnaître dans la liste
  cle_hash              CHAR(64)     NOT NULL UNIQUE,       -- SHA-256 de la clé (la clé en clair n'est JAMAIS stockée)
  actif                 TINYINT(1)   NOT NULL DEFAULT 1,
  nb_appels             INT          NOT NULL DEFAULT 0,
  derniere_utilisation  TIMESTAMP    NULL,
  created_by            INT          NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_apikey_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS webhooks (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  url         VARCHAR(500) NOT NULL,
  evenements  VARCHAR(500) NOT NULL DEFAULT '*',            -- liste séparée par des virgules, '*' = tous
  secret      VARCHAR(100) NOT NULL,                        -- sert à signer les envois (HMAC-SHA256)
  actif       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS webhook_livraisons (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  webhook_id   INT NOT NULL,
  evenement    VARCHAR(60) NOT NULL,
  statut_http  INT NULL,
  succes       TINYINT(1) NOT NULL DEFAULT 0,
  duree_ms     INT NULL,
  reponse      VARCHAR(500) NULL,
  tentative    INT NOT NULL DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_livraison_webhook (webhook_id, id),
  CONSTRAINT fk_livraison_webhook FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_audit (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  user_nom    VARCHAR(100) NULL,
  action      VARCHAR(60)  NOT NULL,
  entite      VARCHAR(40)  NOT NULL,
  entite_id   INT NULL,
  details     JSON NULL,
  ip          VARCHAR(64) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entite (entite, created_at),
  INDEX idx_audit_date (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS emails (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  destinataire  VARCHAR(255) NOT NULL,
  sujet         VARCHAR(255) NOT NULL,
  corps_html    MEDIUMTEXT NOT NULL,
  type          VARCHAR(40)  NOT NULL,
  commande_id   INT NULL,
  statut        ENUM('envoye', 'simule', 'echec') NOT NULL,
  erreur        VARCHAR(500) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_emails_date (created_at),
  CONSTRAINT fk_email_commande FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Index utiles
-- ------------------------------------------------------------
CREATE INDEX idx_produits_categorie ON produits(category_id);
CREATE INDEX idx_commandes_user     ON commandes(user_id);
CREATE INDEX idx_commandes_statut   ON commandes(statut);

-- ------------------------------------------------------------
-- Données de test (les utilisateurs seront créés via l'API
-- pour que les mots de passe soient hachés avec bcrypt)
-- ------------------------------------------------------------
INSERT INTO categories (nom, description) VALUES
  ('Informatique', 'Ordinateurs, accessoires et périphériques'),
  ('Téléphonie',   'Smartphones et accessoires'),
  ('Maison',       'Articles pour la maison');

INSERT INTO produits (nom, description, prix, stock, seuil_alerte, category_id) VALUES
  ('Clavier sans fil',  'Clavier AZERTY sans fil',        45.00, 30, 5, 1),
  ('Souris optique',    'Souris USB 1600 DPI',            25.50, 50, 10, 1),
  ('Écouteurs Bluetooth','Écouteurs avec boîtier de charge', 89.90, 4, 5, 2),
  ('Lampe de bureau',   'Lampe LED réglable',             35.00, 12, 3, 3);

INSERT INTO fournisseurs (nom, email, telephone, adresse) VALUES
  ('TechDistrib Tunisie', 'contact@techdistrib.tn', '71 000 111', 'Tunis'),
  ('Maison & Co',         'ventes@maisonco.tn',     '73 222 333', 'Sousse');

INSERT INTO codes_promo (code, type, valeur, min_commande) VALUES
  ('BIENVENUE10', 'pourcentage', 10, 0),
  ('SOLDES5',     'montant',      5, 30);
