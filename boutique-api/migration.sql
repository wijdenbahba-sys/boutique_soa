-- ============================================================
-- Migration : ajoute les nouvelles tables SANS toucher aux données existantes
-- (historique de stock, fournisseurs, achats).
-- À exécuter UNE fois sur la base boutique_db déjà créée. Relançable sans risque.
-- ============================================================
USE boutique_db;

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
