-- ════════════════════════════════════════════════════════════════════
-- Migration : une convention peut être liée à PLUSIEURS biens ou terrains
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Remplacer les FK uniques Convention.propertyId / Convention.terrainId
--     par deux tables de liaison ConventionProperty / ConventionTerrain
--   - Conserver le champ assetType (PROPERTY | TERRAIN) qui indique
--     dans quelle table de liaison se trouvent les éléments rattachés
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Création des tables de liaison ───────────────────────────────
CREATE TABLE `ConventionProperty` (
    `conventionId` INTEGER NOT NULL,
    `propertyId`   INTEGER NOT NULL,
    `order`        INTEGER NOT NULL DEFAULT 0,
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConventionProperty_propertyId_idx` (`propertyId`),
    PRIMARY KEY (`conventionId`, `propertyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ConventionTerrain` (
    `conventionId` INTEGER NOT NULL,
    `terrainId`    INTEGER NOT NULL,
    `order`        INTEGER NOT NULL DEFAULT 0,
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConventionTerrain_terrainId_idx` (`terrainId`),
    PRIMARY KEY (`conventionId`, `terrainId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 2. Backfill depuis les colonnes existantes ──────────────────────
INSERT INTO `ConventionProperty` (`conventionId`, `propertyId`, `order`)
  SELECT `id`, `propertyId`, 0 FROM `Convention` WHERE `propertyId` IS NOT NULL;

INSERT INTO `ConventionTerrain` (`conventionId`, `terrainId`, `order`)
  SELECT `id`, `terrainId`, 0 FROM `Convention` WHERE `terrainId` IS NOT NULL;

-- ── 3. Ajout des contraintes FK ─────────────────────────────────────
ALTER TABLE `ConventionProperty` ADD CONSTRAINT `ConventionProperty_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConventionProperty` ADD CONSTRAINT `ConventionProperty_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ConventionTerrain` ADD CONSTRAINT `ConventionTerrain_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConventionTerrain` ADD CONSTRAINT `ConventionTerrain_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Suppression des FK et colonnes sur Convention ────────────────
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_propertyId_fkey`;
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_terrainId_fkey`;
ALTER TABLE `Convention` DROP COLUMN `propertyId`;
ALTER TABLE `Convention` DROP COLUMN `terrainId`;
