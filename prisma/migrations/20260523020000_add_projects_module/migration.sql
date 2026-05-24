-- ── PROJECT TYPE ───────────────────────────────────────────────
CREATE TABLE `ProjectType` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(191) NOT NULL,
  `label`       VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `color`       VARCHAR(191) NULL,
  `isActive`    BOOLEAN NOT NULL DEFAULT true,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`   DATETIME(3) NULL,
  UNIQUE INDEX `ProjectType_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── PROJECT ────────────────────────────────────────────────────
CREATE TABLE `Project` (
  `id`              INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`            VARCHAR(191) NOT NULL,
  `reference`       VARCHAR(191) NOT NULL,
  `nom`             VARCHAR(191) NOT NULL,
  `typeId`          INTEGER NOT NULL,
  `statut`          ENUM('EN_PROJET','EN_COURS','SUSPENDU','TERMINE','ANNULE') NOT NULL DEFAULT 'EN_PROJET',
  `clientId`        INTEGER NULL,
  `ownerId`         INTEGER NULL,
  `terrainId`       INTEGER NULL,
  `lotissementId`   INTEGER NULL,
  `programmeId`     INTEGER NULL,
  `adresse`         VARCHAR(191) NULL,
  `commune`         VARCHAR(191) NULL,
  `quartier`        VARCHAR(191) NULL,
  `ville`           VARCHAR(191) NULL,
  `pays`            VARCHAR(191) NOT NULL DEFAULT 'CI',
  `latitude`        DOUBLE NULL,
  `longitude`       DOUBLE NULL,
  `dateDebutPrevu`  DATETIME(3) NULL,
  `dateDebutReel`   DATETIME(3) NULL,
  `dateFinPrevue`   DATETIME(3) NULL,
  `dateFinReelle`   DATETIME(3) NULL,
  `avancement`      INTEGER NOT NULL DEFAULT 0,
  `budgetPrevu`     DECIMAL(15, 2) NULL,
  `budgetRealise`   DECIMAL(15, 2) NULL,
  `description`     TEXT NULL,
  `notes`           TEXT NULL,
  `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`       DATETIME(3) NULL,
  UNIQUE INDEX `Project_uuid_key`(`uuid`),
  UNIQUE INDEX `Project_reference_key`(`reference`),
  INDEX `Project_typeId_idx`(`typeId`),
  INDEX `Project_clientId_idx`(`clientId`),
  INDEX `Project_ownerId_idx`(`ownerId`),
  INDEX `Project_terrainId_idx`(`terrainId`),
  INDEX `Project_lotissementId_idx`(`lotissementId`),
  INDEX `Project_programmeId_idx`(`programmeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Project` ADD CONSTRAINT `Project_typeId_fkey`
  FOREIGN KEY (`typeId`) REFERENCES `ProjectType`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Project` ADD CONSTRAINT `Project_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Project` ADD CONSTRAINT `Project_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Project` ADD CONSTRAINT `Project_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Project` ADD CONSTRAINT `Project_lotissementId_fkey`
  FOREIGN KEY (`lotissementId`) REFERENCES `Lotissement`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Project` ADD CONSTRAINT `Project_programmeId_fkey`
  FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── PROJECT PHOTO ──────────────────────────────────────────────
CREATE TABLE `ProjectPhoto` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `projectId` INTEGER NOT NULL,
  `path`      VARCHAR(191) NOT NULL,
  `caption`   VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `order`     INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ProjectPhoto_projectId_idx`(`projectId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProjectPhoto` ADD CONSTRAINT `ProjectPhoto_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── DOCUMENT — ajout projectId ─────────────────────────────────
ALTER TABLE `Document` ADD COLUMN `projectId` INTEGER NULL;

ALTER TABLE `Document` ADD CONSTRAINT `Document_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CRMACTIVITY — ajout projectId ──────────────────────────────
ALTER TABLE `CrmActivity` ADD COLUMN `projectId` INTEGER NULL;

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── SEED DES TYPES DE PROJETS INITIAUX ─────────────────────────
INSERT INTO `ProjectType` (`code`, `label`, `description`, `isActive`, `createdAt`, `updatedAt`) VALUES
  ('CONSTRUCTION_BATIMENTS',       'Construction de bâtiments',       NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('CONSTRUCTION_OUVRAGES_PUBLICS','Construction d''ouvrages publics', NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('OUVERTURES_VOIES',             'Ouvertures de voies',              NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('DECAPAGE',                     'Décapage',                         NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('BORNAGE',                      'Bornage',                          NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('REPROFILAGE_ROUTE',            'Reprofilage de route',             NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('BITUMAGE',                     'Bitumage',                         NULL, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
