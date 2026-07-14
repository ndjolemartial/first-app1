-- ════════════════════════════════════════════════════════════════════
-- Migration : un devis peut être lié à PLUSIEURS terrains ou biens
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Ajouter deux tables de liaison QuoteTerrain / QuoteProperty (même
--     principe que AttestationTerrain / AttestationProperty)
--   - Conserver Quote.terrainId / propertyId (compatibilité : conversion en
--     convention/facture, devis mono-bien historiques) ; ils sont alignés
--     sur le 1ᵉʳ élément de la sélection multiple à l'enregistrement.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Création des tables de liaison ───────────────────────────────
CREATE TABLE `QuoteTerrain` (
    `quoteId`   INTEGER NOT NULL,
    `terrainId` INTEGER NOT NULL,
    `order`     INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteTerrain_terrainId_idx` (`terrainId`),
    PRIMARY KEY (`quoteId`, `terrainId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuoteProperty` (
    `quoteId`    INTEGER NOT NULL,
    `propertyId` INTEGER NOT NULL,
    `order`      INTEGER NOT NULL DEFAULT 0,
    `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuoteProperty_propertyId_idx` (`propertyId`),
    PRIMARY KEY (`quoteId`, `propertyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 2. Backfill depuis les colonnes existantes ──────────────────────
INSERT INTO `QuoteTerrain` (`quoteId`, `terrainId`, `order`)
  SELECT `id`, `terrainId`, 0 FROM `Quote` WHERE `terrainId` IS NOT NULL;

INSERT INTO `QuoteProperty` (`quoteId`, `propertyId`, `order`)
  SELECT `id`, `propertyId`, 0 FROM `Quote` WHERE `propertyId` IS NOT NULL;

-- ── 3. Ajout des contraintes FK ─────────────────────────────────────
ALTER TABLE `QuoteTerrain` ADD CONSTRAINT `QuoteTerrain_quoteId_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuoteTerrain` ADD CONSTRAINT `QuoteTerrain_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QuoteProperty` ADD CONSTRAINT `QuoteProperty_quoteId_fkey`
  FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `QuoteProperty` ADD CONSTRAINT `QuoteProperty_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
