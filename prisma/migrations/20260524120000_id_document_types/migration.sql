-- ── TYPES DE PIÈCES D'IDENTITÉ ────────────────────────────────
-- Catalogue extensible (CNI, Passeport, etc.) géré depuis les Paramètres.
-- Référencé par Client.idTypeId, Owner.idTypeId et Owner.legalRepIdTypeId.

CREATE TABLE `IdDocumentType` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `code`      VARCHAR(191) NOT NULL,
  `label`     VARCHAR(191) NOT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isActive`  BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `IdDocumentType_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed : Carte Nationale d'Identité (par défaut).
INSERT INTO `IdDocumentType` (`code`, `label`, `isDefault`, `isActive`, `updatedAt`)
VALUES ('CNI', 'Carte Nationale d\'Identité (CNI)', true, true, CURRENT_TIMESTAMP(3));

-- Colonnes de rattachement
ALTER TABLE `Client` ADD COLUMN `idTypeId` INTEGER NULL;
ALTER TABLE `Owner`  ADD COLUMN `idTypeId` INTEGER NULL;
ALTER TABLE `Owner`  ADD COLUMN `legalRepIdTypeId` INTEGER NULL;

CREATE INDEX `Client_idTypeId_idx`         ON `Client`(`idTypeId`);
CREATE INDEX `Owner_idTypeId_idx`          ON `Owner`(`idTypeId`);
CREATE INDEX `Owner_legalRepIdTypeId_idx`  ON `Owner`(`legalRepIdTypeId`);

ALTER TABLE `Client` ADD CONSTRAINT `Client_idTypeId_fkey`
  FOREIGN KEY (`idTypeId`) REFERENCES `IdDocumentType`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Owner` ADD CONSTRAINT `Owner_idTypeId_fkey`
  FOREIGN KEY (`idTypeId`) REFERENCES `IdDocumentType`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Owner` ADD CONSTRAINT `Owner_legalRepIdTypeId_fkey`
  FOREIGN KEY (`legalRepIdTypeId`) REFERENCES `IdDocumentType`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
