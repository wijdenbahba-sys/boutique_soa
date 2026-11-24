-- ============================================================
-- Migration : ajoute les nouvelles tables et colonnes SANS toucher aux données existantes
-- (v2 : historique de stock, fournisseurs, achats ; v3 : favoris, avis, codes promo, livraison ; v4 : paiement, clés API, webhooks, audit, emails).
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

-- ============================================================
-- v3
-- ============================================================

-- Ajoute une colonne seulement si elle n'existe pas encore (MySQL n'a pas ADD COLUMN IF NOT EXISTS)
DROP PROCEDURE IF EXISTS ajouter_colonne;
DELIMITER //
CREATE PROCEDURE ajouter_colonne(IN p_table VARCHAR(64), IN p_colonne VARCHAR(64), IN p_definition VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_colonne
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_colonne, '` ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL ajouter_colonne('produits',  'image_url',         'VARCHAR(255) NULL');
CALL ajouter_colonne('commandes', 'code_promo',        'VARCHAR(40) NULL');
CALL ajouter_colonne('commandes', 'remise',            'DECIMAL(10,2) NOT NULL DEFAULT 0');
CALL ajouter_colonne('commandes', 'adresse_livraison', 'VARCHAR(255) NULL');
CALL ajouter_colonne('commandes', 'ville',             'VARCHAR(80) NULL');
CALL ajouter_colonne('commandes', 'telephone',         'VARCHAR(30) NULL');

DROP PROCEDURE IF EXISTS ajouter_colonne;

CREATE TABLE IF NOT EXISTS favoris (
  user_id     INT NOT NULL,
  produit_id  INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, produit_id),
  CONSTRAINT fk_fav_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_fav_produit FOREIGN KEY (produit_id) REFERENCES produits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

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

-- ============================================================
-- v4 : paiement simulé, clés API, webhooks, journal d'audit, emails
-- ============================================================
DROP PROCEDURE IF EXISTS ajouter_colonne;
DELIMITER //
CREATE PROCEDURE ajouter_colonne(IN p_table VARCHAR(64), IN p_colonne VARCHAR(64), IN p_definition VARCHAR(500))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_colonne) THEN
    SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_colonne, ' ', p_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL ajouter_colonne('commandes', 'mode_paiement',       "ENUM('livraison', 'carte') NOT NULL DEFAULT 'livraison'");
CALL ajouter_colonne('commandes', 'statut_paiement',     "ENUM('en_attente', 'paye', 'echoue', 'rembourse') NOT NULL DEFAULT 'en_attente'");
CALL ajouter_colonne('commandes', 'paiement_marque',     'VARCHAR(20) NULL');
CALL ajouter_colonne('commandes', 'paiement_last4',      'CHAR(4) NULL');
CALL ajouter_colonne('commandes', 'paiement_reference',  'VARCHAR(40) NULL');

DROP PROCEDURE IF EXISTS ajouter_colonne;

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

-- Codes promo d'exemple (ignorés s'ils existent déjà)
INSERT IGNORE INTO codes_promo (code, type, valeur, min_commande) VALUES
  ('BIENVENUE10', 'pourcentage', 10, 0),
  ('SOLDES5',     'montant',      5, 30);
