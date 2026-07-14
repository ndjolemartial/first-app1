-- Ligne téléphonique de l'appel (référentiel paramétrable, même principe que
-- le champ « Poste » de la fiche employé).

CREATE TABLE `PhoneLine` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `label`     VARCHAR(191) NOT NULL,
  `isActive`  BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `PhoneLine_label_key`(`label`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PhoneCall` ADD COLUMN `ligne` VARCHAR(191) NULL AFTER `direction`;
