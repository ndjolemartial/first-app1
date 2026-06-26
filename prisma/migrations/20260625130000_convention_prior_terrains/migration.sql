-- Avenant de transfert de site / changement de lot : « Terrains antérieurs
-- rattachés » (distincts des terrains rattachés courants) + énumération figée
-- des lots antérieurs souscrits (variable {{convention.lotsAnterieursSouscrits}}).

-- ── 1. Colonne d'énumération figée des lots antérieurs souscrits ─────
ALTER TABLE `Convention` ADD COLUMN `lotsAnterieursSouscrits` TEXT NULL;

-- ── 2. Table de liaison Convention ↔ Terrain antérieur ──────────────
CREATE TABLE `ConventionPriorTerrain` (
    `conventionId` INTEGER NOT NULL,
    `terrainId`    INTEGER NOT NULL,
    `order`        INTEGER NOT NULL DEFAULT 0,
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConventionPriorTerrain_terrainId_idx` (`terrainId`),
    PRIMARY KEY (`conventionId`, `terrainId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 3. Contraintes FK ───────────────────────────────────────────────
ALTER TABLE `ConventionPriorTerrain` ADD CONSTRAINT `ConventionPriorTerrain_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConventionPriorTerrain` ADD CONSTRAINT `ConventionPriorTerrain_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
