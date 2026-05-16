-- ── LOTISSEMENT ───────────────────────────────────────────────
CREATE TABLE `Lotissement` (
  `id`              INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`            VARCHAR(191) NOT NULL,
  `reference`       VARCHAR(191) NOT NULL,
  `nom`             VARCHAR(191) NOT NULL,
  `commune`         VARCHAR(191) NULL,
  `quartier`        VARCHAR(191) NULL,
  `ville`           VARCHAR(191) NOT NULL,
  `pays`            VARCHAR(191) NOT NULL DEFAULT 'CI',
  `surface`         DECIMAL(12, 2) NULL,
  `nombreParcelles` INTEGER NULL,
  `promoteur`       VARCHAR(191) NULL,
  `statut`          ENUM('EN_COURS','OUVERT','PARTIELLEMENT_VENDU','COMPLET','FERME') NOT NULL DEFAULT 'EN_COURS',
  `description`     TEXT NULL,
  `latitude`        DOUBLE NULL,
  `longitude`       DOUBLE NULL,
  `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`       DATETIME(3) NULL,
  UNIQUE INDEX `Lotissement_uuid_key`(`uuid`),
  UNIQUE INDEX `Lotissement_reference_key`(`reference`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── TERRAIN ────────────────────────────────────────────────────
CREATE TABLE `Terrain` (
  `id`             INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`           VARCHAR(191) NOT NULL,
  `reference`      VARCHAR(191) NOT NULL,
  `lotissementId`  INTEGER NOT NULL,
  `ownerId`        INTEGER NULL,
  `numeroIlot`     VARCHAR(191) NULL,
  `numeroParcelle` VARCHAR(191) NULL,
  `statut`         ENUM('DISPONIBLE','RESERVE','VENDU','SOUS_OPTION') NOT NULL DEFAULT 'DISPONIBLE',
  `surface`        DECIMAL(12, 2) NOT NULL,
  `prixVente`      DECIMAL(15, 2) NULL,
  `viabilise`      BOOLEAN NOT NULL DEFAULT false,
  `titreFoncier`   VARCHAR(191) NULL,
  `description`    TEXT NULL,
  `latitude`       DOUBLE NULL,
  `longitude`      DOUBLE NULL,
  `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt`      DATETIME(3) NULL,
  UNIQUE INDEX `Terrain_uuid_key`(`uuid`),
  UNIQUE INDEX `Terrain_reference_key`(`reference`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Terrain` ADD CONSTRAINT `Terrain_lotissementId_fkey`
  FOREIGN KEY (`lotissementId`) REFERENCES `Lotissement`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Terrain` ADD CONSTRAINT `Terrain_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── TERRAIN PHOTOS ─────────────────────────────────────────────
CREATE TABLE `TerrainPhoto` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `terrainId` INTEGER NOT NULL,
  `path`      VARCHAR(191) NOT NULL,
  `caption`   VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `order`     INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TerrainPhoto` ADD CONSTRAINT `TerrainPhoto_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── RETIRER TERRAIN DE PropertyType ────────────────────────────
ALTER TABLE `Property`
  MODIFY COLUMN `type` ENUM('APARTEMENT','DUPLEX','VILLA','STUDIO','BUREAU','PARKING','AUTRE') NOT NULL;

-- ── DOCUMENT — ajout lotissementId et terrainId ────────────────
ALTER TABLE `Document`
  ADD COLUMN `lotissementId` INTEGER NULL,
  ADD COLUMN `terrainId`     INTEGER NULL;

ALTER TABLE `Document` ADD CONSTRAINT `Document_lotissementId_fkey`
  FOREIGN KEY (`lotissementId`) REFERENCES `Lotissement`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Document` ADD CONSTRAINT `Document_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CRMACTIVITY — ajout lotissementId et terrainId ────────────
ALTER TABLE `CrmActivity`
  ADD COLUMN `lotissementId` INTEGER NULL,
  ADD COLUMN `terrainId`     INTEGER NULL;

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_lotissementId_fkey`
  FOREIGN KEY (`lotissementId`) REFERENCES `Lotissement`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
