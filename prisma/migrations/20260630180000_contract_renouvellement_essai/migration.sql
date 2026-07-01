-- Type de contrat « RENOUVELLEMENT_ESSAI » (lettre de renouvellement rattachée
-- à un contrat ESSAI ; durée = essai initial) + table des catégories
-- socio-professionnelles et leurs délais d'essai paramétrables.
ALTER TABLE `EmploymentContract`
  MODIFY `type` ENUM('CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI', 'AVENANT_CDD', 'RENOUVELLEMENT_ESSAI') NOT NULL DEFAULT 'CDI';
ALTER TABLE `ContractTemplate`
  MODIFY `type` ENUM('CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI', 'AVENANT_CDD', 'RENOUVELLEMENT_ESSAI') NOT NULL;

CREATE TABLE `EssaiCategory` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `label` VARCHAR(191) NOT NULL,
  `durationValue` INTEGER NOT NULL,
  `durationUnit` ENUM('JOURS', 'MOIS') NOT NULL DEFAULT 'MOIS',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,
  UNIQUE INDEX `EssaiCategory_label_key`(`label`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
