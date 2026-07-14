-- ════════════════════════════════════════════════════════════════════
-- Migration : une attestation peut être liée à PLUSIEURS terrains ou biens
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Ajouter deux tables de liaison AttestationTerrain / AttestationProperty
--     (même principe que ConventionTerrain / ConventionProperty)
--   - Conserver Attestation.terrainId / propertyId (compatibilité : mode
--     souscription héritée, attestations mono-bien historiques) ; ils sont
--     alignés sur le 1ᵉʳ élément de la sélection multiple à l'enregistrement.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Création des tables de liaison ───────────────────────────────
CREATE TABLE `AttestationTerrain` (
    `attestationId` INTEGER NOT NULL,
    `terrainId`     INTEGER NOT NULL,
    `order`         INTEGER NOT NULL DEFAULT 0,
    `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttestationTerrain_terrainId_idx` (`terrainId`),
    PRIMARY KEY (`attestationId`, `terrainId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AttestationProperty` (
    `attestationId` INTEGER NOT NULL,
    `propertyId`    INTEGER NOT NULL,
    `order`         INTEGER NOT NULL DEFAULT 0,
    `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttestationProperty_propertyId_idx` (`propertyId`),
    PRIMARY KEY (`attestationId`, `propertyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 2. Backfill depuis les colonnes existantes ──────────────────────
INSERT INTO `AttestationTerrain` (`attestationId`, `terrainId`, `order`)
  SELECT `id`, `terrainId`, 0 FROM `Attestation` WHERE `terrainId` IS NOT NULL;

INSERT INTO `AttestationProperty` (`attestationId`, `propertyId`, `order`)
  SELECT `id`, `propertyId`, 0 FROM `Attestation` WHERE `propertyId` IS NOT NULL;

-- ── 3. Ajout des contraintes FK ─────────────────────────────────────
ALTER TABLE `AttestationTerrain` ADD CONSTRAINT `AttestationTerrain_attestationId_fkey`
  FOREIGN KEY (`attestationId`) REFERENCES `Attestation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AttestationTerrain` ADD CONSTRAINT `AttestationTerrain_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AttestationProperty` ADD CONSTRAINT `AttestationProperty_attestationId_fkey`
  FOREIGN KEY (`attestationId`) REFERENCES `Attestation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AttestationProperty` ADD CONSTRAINT `AttestationProperty_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
