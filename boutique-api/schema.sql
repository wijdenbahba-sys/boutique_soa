-- ============================================================
-- Mini-projet SOA : Service web de gestion d'inventaire (boutique en ligne)
-- Base de données : MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS boutique_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE boutique_db;

-- Pour pouvoir relancer le script sans erreur
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
  total          DECIMAL(10,2) NOT NULL DEFAULT 0,
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
