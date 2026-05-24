-- ── DOCUMENT — extension GED ───────────────────────────────────
ALTER TABLE `Document`
  ADD COLUMN `numeroArchive` VARCHAR(191) NULL,
  ADD COLUMN `description`   TEXT NULL,
  ADD COLUMN `categoryId`    INTEGER NULL,
  ADD COLUMN `folderId`      INTEGER NULL,
  ADD COLUMN `uploadedById`  INTEGER NULL,
  ADD COLUMN `ocrText`       LONGTEXT NULL,
  ADD COLUMN `isPhysical`    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `physBureau`    VARCHAR(191) NULL,
  ADD COLUMN `physCarton`    VARCHAR(191) NULL,
  ADD COLUMN `physClasseur`  VARCHAR(191) NULL,
  ADD COLUMN `updatedAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ADD COLUMN `deletedAt`     DATETIME(3) NULL;

-- Numéro d'archive des documents existants (préfixe LEG = hérité).
UPDATE `Document` SET `numeroArchive` = CONCAT('ARC-LEG-', LPAD(`id`, 5, '0')) WHERE `numeroArchive` IS NULL;

CREATE UNIQUE INDEX `Document_numeroArchive_key` ON `Document`(`numeroArchive`);
CREATE INDEX `Document_categoryId_idx` ON `Document`(`categoryId`);
CREATE INDEX `Document_folderId_idx` ON `Document`(`folderId`);
CREATE INDEX `Document_uploadedById_idx` ON `Document`(`uploadedById`);

-- ── DOCUMENT CATEGORY ──────────────────────────────────────────
CREATE TABLE `DocumentCategory` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(191) NOT NULL,
  `parentId`  INTEGER NULL,
  `color`     VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  INDEX `DocumentCategory_parentId_idx`(`parentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── DOCUMENT FOLDER ────────────────────────────────────────────
CREATE TABLE `DocumentFolder` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(191) NOT NULL,
  `parentId`  INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  INDEX `DocumentFolder_parentId_idx`(`parentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── DOCUMENT TAG (jointure document ↔ étiquette) ───────────────
CREATE TABLE `DocumentTag` (
  `documentId` INTEGER NOT NULL,
  `tagId`      INTEGER NOT NULL,
  INDEX `DocumentTag_tagId_idx`(`tagId`),
  PRIMARY KEY (`documentId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── DOCUMENT AUDIT LOG (journal des actions) ───────────────────
CREATE TABLE `DocumentAuditLog` (
  `id`         INTEGER NOT NULL AUTO_INCREMENT,
  `documentId` INTEGER NULL,
  `action`     ENUM('IMPORT','CONSULTATION','MODIFICATION','SUPPRESSION','TELECHARGEMENT','RESTAURATION') NOT NULL,
  `userId`     INTEGER NULL,
  `detail`     TEXT NULL,
  `createdAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `DocumentAuditLog_documentId_idx`(`documentId`),
  INDEX `DocumentAuditLog_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Clés étrangères ────────────────────────────────────────────
ALTER TABLE `Document` ADD CONSTRAINT `Document_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `DocumentCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Document` ADD CONSTRAINT `Document_folderId_fkey`
  FOREIGN KEY (`folderId`) REFERENCES `DocumentFolder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Document` ADD CONSTRAINT `Document_uploadedById_fkey`
  FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentCategory` ADD CONSTRAINT `DocumentCategory_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `DocumentCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentFolder` ADD CONSTRAINT `DocumentFolder_parentId_fkey`
  FOREIGN KEY (`parentId`) REFERENCES `DocumentFolder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentTag` ADD CONSTRAINT `DocumentTag_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTag` ADD CONSTRAINT `DocumentTag_tagId_fkey`
  FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `DocumentAuditLog` ADD CONSTRAINT `DocumentAuditLog_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DocumentAuditLog` ADD CONSTRAINT `DocumentAuditLog_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
