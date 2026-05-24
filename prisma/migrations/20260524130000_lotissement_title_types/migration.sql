-- ── NATURES DE TITRES DE LOTISSEMENT ──────────────────────────
-- Catalogue extensible (Arrêté d'approbation, Permis d'aménager, etc.)
-- géré depuis les Paramètres et référencé par Lotissement.titleTypeId.

CREATE TABLE `LotissementTitleType` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `code`      VARCHAR(191) NOT NULL,
  `label`     VARCHAR(191) NOT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isActive`  BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `LotissementTitleType_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed : Arrêté d'approbation (par défaut).
INSERT INTO `LotissementTitleType` (`code`, `label`, `isDefault`, `isActive`, `updatedAt`)
VALUES ('ARRETE_APPROBATION', 'Arrêté d\'approbation', true, true, CURRENT_TIMESTAMP(3));

-- Colonnes de rattachement sur Lotissement
ALTER TABLE `Lotissement`
  ADD COLUMN `titleTypeId` INTEGER NULL,
  ADD COLUMN `titleNumber` VARCHAR(191) NULL;

CREATE INDEX `Lotissement_titleTypeId_idx` ON `Lotissement`(`titleTypeId`);

ALTER TABLE `Lotissement` ADD CONSTRAINT `Lotissement_titleTypeId_fkey`
  FOREIGN KEY (`titleTypeId`) REFERENCES `LotissementTitleType`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
