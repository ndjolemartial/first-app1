-- DocumentFolder : type de dossier + propriétaire (espace perso / partagé).
ALTER TABLE `DocumentFolder`
  ADD COLUMN `kind` ENUM('GENERAL', 'PERSONAL', 'SHARED') NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN `ownerId` INTEGER NULL;

ALTER TABLE `DocumentFolder`
  ADD CONSTRAINT `DocumentFolder_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Droits d'accès aux dossiers partagés (lecture + dépôt).
CREATE TABLE `DocumentFolderAccess` (
  `folderId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  PRIMARY KEY (`folderId`, `userId`),
  INDEX `DocumentFolderAccess_userId_idx` (`userId`),
  CONSTRAINT `DocumentFolderAccess_folderId_fkey`
    FOREIGN KEY (`folderId`) REFERENCES `DocumentFolder`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DocumentFolderAccess_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
