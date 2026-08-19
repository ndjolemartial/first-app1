-- Étend la « Fiche KYC » aux Propriétaires et Apporteurs d'affaire, même
-- principe que Client.* (migrations 20260818160000 et suivantes) : bloc
-- « Informations complémentaires » + bénéficiaires effectifs.
ALTER TABLE `Owner`
  ADD COLUMN `employerName` VARCHAR(191) NULL AFTER `compte_contribuable`,
  ADD COLUMN `monthlyIncome` DECIMAL(15, 2) NULL AFTER `employerName`,
  ADD COLUMN `sourceOfFunds` JSON NULL AFTER `monthlyIncome`,
  ADD COLUMN `sourceOfFundsOther` VARCHAR(191) NULL AFTER `sourceOfFunds`,
  ADD COLUMN `sourceOfWealth` TEXT NULL AFTER `sourceOfFundsOther`,
  ADD COLUMN `relationshipPurpose` JSON NULL AFTER `sourceOfWealth`,
  ADD COLUMN `relationshipPurposeOther` VARCHAR(191) NULL AFTER `relationshipPurpose`,
  ADD COLUMN `expectedTransactionVolume` DECIMAL(15, 2) NULL AFTER `relationshipPurposeOther`,
  ADD COLUMN `acquisitionChannel` VARCHAR(191) NULL AFTER `expectedTransactionVolume`,
  ADD COLUMN `isPep` BOOLEAN NOT NULL DEFAULT false AFTER `acquisitionChannel`,
  ADD COLUMN `pepCategory` ENUM('PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP') NULL AFTER `isPep`,
  ADD COLUMN `pepFunction` VARCHAR(191) NULL AFTER `pepCategory`,
  ADD COLUMN `hasRiskyCountryLink` BOOLEAN NOT NULL DEFAULT false AFTER `pepFunction`,
  ADD COLUMN `kycSignedAt` DATETIME(3) NULL AFTER `hasRiskyCountryLink`,
  ADD COLUMN `kycSignedPlace` VARCHAR(191) NULL AFTER `kycSignedAt`;

CREATE TABLE `OwnerBeneficialOwner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ownerId` INTEGER NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NULL,
    `idNumber` VARCHAR(191) NULL,
    `ownershipPct` DECIMAL(5, 2) NULL,
    `role` VARCHAR(191) NULL,
    `isPep` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `OwnerBeneficialOwner_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OwnerBeneficialOwner` ADD CONSTRAINT `OwnerBeneficialOwner_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BusinessReferrer`
  ADD COLUMN `employerName` VARCHAR(191) NULL AFTER `bankBic`,
  ADD COLUMN `monthlyIncome` DECIMAL(15, 2) NULL AFTER `employerName`,
  ADD COLUMN `sourceOfFunds` JSON NULL AFTER `monthlyIncome`,
  ADD COLUMN `sourceOfFundsOther` VARCHAR(191) NULL AFTER `sourceOfFunds`,
  ADD COLUMN `sourceOfWealth` TEXT NULL AFTER `sourceOfFundsOther`,
  ADD COLUMN `relationshipPurpose` JSON NULL AFTER `sourceOfWealth`,
  ADD COLUMN `relationshipPurposeOther` VARCHAR(191) NULL AFTER `relationshipPurpose`,
  ADD COLUMN `expectedTransactionVolume` DECIMAL(15, 2) NULL AFTER `relationshipPurposeOther`,
  ADD COLUMN `acquisitionChannel` VARCHAR(191) NULL AFTER `expectedTransactionVolume`,
  ADD COLUMN `isPep` BOOLEAN NOT NULL DEFAULT false AFTER `acquisitionChannel`,
  ADD COLUMN `pepCategory` ENUM('PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP') NULL AFTER `isPep`,
  ADD COLUMN `pepFunction` VARCHAR(191) NULL AFTER `pepCategory`,
  ADD COLUMN `hasRiskyCountryLink` BOOLEAN NOT NULL DEFAULT false AFTER `pepFunction`,
  ADD COLUMN `kycSignedAt` DATETIME(3) NULL AFTER `hasRiskyCountryLink`,
  ADD COLUMN `kycSignedPlace` VARCHAR(191) NULL AFTER `kycSignedAt`;

CREATE TABLE `ReferrerBeneficialOwner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `referrerId` INTEGER NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `nationality` VARCHAR(191) NULL,
    `idNumber` VARCHAR(191) NULL,
    `ownershipPct` DECIMAL(5, 2) NULL,
    `role` VARCHAR(191) NULL,
    `isPep` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ReferrerBeneficialOwner_referrerId_idx`(`referrerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReferrerBeneficialOwner` ADD CONSTRAINT `ReferrerBeneficialOwner_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `BusinessReferrer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
