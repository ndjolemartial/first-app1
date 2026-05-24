-- ── PROGRAMME IMMOBILIER ───────────────────────────────────────
CREATE TABLE `ProgrammeImmobilier` (
  `id`                  INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`                VARCHAR(191) NOT NULL,
  `reference`           VARCHAR(191) NOT NULL,
  `nom`                 VARCHAR(191) NOT NULL,
  `type`                ENUM('RESIDENTIEL','COMMERCIAL','MIXTE') NOT NULL DEFAULT 'RESIDENTIEL',
  `promoteur`           VARCHAR(191) NULL,
  `commune`             VARCHAR(191) NULL,
  `quartier`            VARCHAR(191) NULL,
  `ville`               VARCHAR(191) NOT NULL,
  `pays`                VARCHAR(191) NOT NULL DEFAULT 'CI',
  `surface`             DECIMAL(12, 2) NULL,
  `nombreLogements`     INTEGER NULL,
  `dateDebut`           DATETIME(3) NULL,
  `dateLivraisonPrevue` DATETIME(3) NULL,
  `statut`              ENUM('EN_PROJET','EN_CONSTRUCTION','EN_COMMERCIALISATION','LIVRE','CLOTURE') NOT NULL DEFAULT 'EN_PROJET',
  `description`         TEXT NULL,
  `latitude`            DOUBLE NULL,
  `longitude`           DOUBLE NULL,
  `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`           DATETIME(3) NULL,
  UNIQUE INDEX `ProgrammeImmobilier_uuid_key`(`uuid`),
  UNIQUE INDEX `ProgrammeImmobilier_reference_key`(`reference`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── PROPERTY — ownerId rendu optionnel + ajout programmeId ─────
ALTER TABLE `Property` DROP FOREIGN KEY `Property_ownerId_fkey`;

ALTER TABLE `Property`
  MODIFY COLUMN `ownerId` INTEGER NULL,
  ADD COLUMN `programmeId` INTEGER NULL;

ALTER TABLE `Property` ADD CONSTRAINT `Property_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Property` ADD CONSTRAINT `Property_programmeId_fkey`
  FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── TERRAIN — ajout programmeId ────────────────────────────────
ALTER TABLE `Terrain` ADD COLUMN `programmeId` INTEGER NULL;

ALTER TABLE `Terrain` ADD CONSTRAINT `Terrain_programmeId_fkey`
  FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── DOCUMENT — ajout programmeId ───────────────────────────────
ALTER TABLE `Document` ADD COLUMN `programmeId` INTEGER NULL;

ALTER TABLE `Document` ADD CONSTRAINT `Document_programmeId_fkey`
  FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CRMACTIVITY — ajout programmeId ────────────────────────────
ALTER TABLE `CrmActivity` ADD COLUMN `programmeId` INTEGER NULL;

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_programmeId_fkey`
  FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
