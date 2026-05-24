-- ════════════════════════════════════════════════════════════════════
-- Migration : refonte des statuts Property + rattachement Client
-- ════════════════════════════════════════════════════════════════════
--  Objectifs :
--   - Ajouter le statut RESERVE
--   - Renommer SOLDE → VENDU (préservation des données existantes)
--   - Réordonner la liste : DISPONIBLE, RESERVE, SOUS_OPTION, VENDU,
--     EN_LOCATION, EN_RENOVATION, INDISPONIBLE
--   - Ajouter Property.clientId (FK Client, ON DELETE SET NULL)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Étendre temporairement l'enum (SOLDE + VENDU + RESERVE coexistent) ─
ALTER TABLE `Property` MODIFY COLUMN `status`
  ENUM('DISPONIBLE', 'RESERVE', 'INDISPONIBLE', 'EN_LOCATION', 'SOLDE', 'VENDU', 'SOUS_OPTION', 'EN_RENOVATION')
  NOT NULL DEFAULT 'DISPONIBLE';

-- ── 2. Migration des données SOLDE → VENDU ──────────────────────────
UPDATE `Property` SET `status` = 'VENDU' WHERE `status` = 'SOLDE';

-- ── 3. Enum final (ordre voulu, SOLDE supprimé) ─────────────────────
ALTER TABLE `Property` MODIFY COLUMN `status`
  ENUM('DISPONIBLE', 'RESERVE', 'SOUS_OPTION', 'VENDU', 'EN_LOCATION', 'EN_RENOVATION', 'INDISPONIBLE')
  NOT NULL DEFAULT 'DISPONIBLE';

-- ── 4. Ajout de la colonne clientId + FK ────────────────────────────
ALTER TABLE `Property` ADD COLUMN `clientId` INTEGER NULL;
ALTER TABLE `Property` ADD CONSTRAINT `Property_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
