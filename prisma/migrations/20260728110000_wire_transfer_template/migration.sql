-- Modèle éditable de l'« Ordre de virement » (Paramètres → Modèles
-- d'imprimés), fiche paysage listant les salaires nets à payer du mois avec
-- les références bancaires des employés.

-- CreateTable
CREATE TABLE `WireTransferTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Modèle par défaut',
    `introHtml` LONGTEXT NULL,
    `tableTitle` VARCHAR(191) NOT NULL DEFAULT 'LISTE DES BÉNÉFICIAIRES',
    `signatureLabel` VARCHAR(191) NOT NULL DEFAULT 'Le Directeur Général',
    `columnWidths` JSON NULL,
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#1E3A5F',
    `showLogo` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WireTransferTemplate_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
