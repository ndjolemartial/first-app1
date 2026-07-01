-- Référentiel « Fonction de l'employé » (titre + contenu en liste) + rattachement
-- au contrat de travail.
CREATE TABLE `ContractFunction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `titre` VARCHAR(191) NOT NULL,
  `contenu` TEXT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmploymentContract` ADD COLUMN `functionId` INTEGER NULL;
CREATE INDEX `EmploymentContract_functionId_idx` ON `EmploymentContract`(`functionId`);
ALTER TABLE `EmploymentContract`
  ADD CONSTRAINT `EmploymentContract_functionId_fkey`
  FOREIGN KEY (`functionId`) REFERENCES `ContractFunction`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
