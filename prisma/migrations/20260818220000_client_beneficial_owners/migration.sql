-- Bénéficiaires effectifs d'un client personne morale (Entreprise ou
-- Association / ONG) — même structure que AmlBeneficialOwner (Module 19),
-- rattachés directement au client, repris sur la Fiche KYC imprimable.
CREATE TABLE `ClientBeneficialOwner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
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

    INDEX `ClientBeneficialOwner_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ClientBeneficialOwner` ADD CONSTRAINT `ClientBeneficialOwner_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
