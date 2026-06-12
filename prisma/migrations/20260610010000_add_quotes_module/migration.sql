-- ════════════════════════════════════════════════════════════════════
-- Migration : module Devis (Quote / QuoteItem / QuoteTemplate)
-- ════════════════════════════════════════════════════════════════════
-- Offre commerciale chiffrée (vente immobilière ou prestation) précédant la
-- contractualisation. Référence auto DEV-YYYY-NNNN. Ajoute aussi le
-- rattachement `quoteId` sur CrmActivity et Document.
-- Migration purement additive (nouvelles tables + colonnes nullables).
-- ════════════════════════════════════════════════════════════════════

-- CreateTable : modèle de devis paramétrable
CREATE TABLE `QuoteTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `header` LONGTEXT NULL,
    `headerWidth` INTEGER NOT NULL DEFAULT 100,
    `headerHeight` INTEGER NOT NULL DEFAULT 140,
    `body` LONGTEXT NOT NULL,
    `footer` LONGTEXT NULL,
    `footerWidth` INTEGER NOT NULL DEFAULT 100,
    `footerHeight` INTEGER NOT NULL DEFAULT 140,
    `footerBgColor` VARCHAR(20) NULL,
    `endOfDocument` LONGTEXT NULL,
    `endOfDocumentWidth` INTEGER NOT NULL DEFAULT 100,
    `endOfDocumentHeight` INTEGER NOT NULL DEFAULT 140,
    `endOfDocumentBgColor` VARCHAR(20) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `QuoteTemplate_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable : devis
CREATE TABLE `Quote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `type` ENUM('VENTE_TERRAIN', 'VENTE_BIEN', 'PRESTATION', 'FRAIS') NOT NULL DEFAULT 'VENTE_TERRAIN',
    `status` ENUM('BROUILLON', 'ENVOYE', 'ACCEPTE', 'REFUSE', 'EXPIRE', 'ANNULE') NOT NULL DEFAULT 'BROUILLON',
    `prospectId` INTEGER NULL,
    `clientId` INTEGER NULL,
    `terrainId` INTEGER NULL,
    `propertyId` INTEGER NULL,
    `programmeId` INTEGER NULL,
    `lotissementId` INTEGER NULL,
    `agentId` INTEGER NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `refusedAt` DATETIME(3) NULL,
    `refusalReason` TEXT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `depositExpected` DECIMAL(15, 2) NULL,
    `paymentModalites` ENUM('CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS') NOT NULL DEFAULT 'CASH',
    `installmentCount` INTEGER NULL,
    `notes` TEXT NULL,
    `conditions` TEXT NULL,
    `templateId` INTEGER NULL,
    `convertedConventionId` INTEGER NULL,
    `convertedInvoiceId` INTEGER NULL,
    `convertedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Quote_uuid_key`(`uuid`),
    UNIQUE INDEX `Quote_reference_key`(`reference`),
    INDEX `Quote_clientId_idx`(`clientId`),
    INDEX `Quote_prospectId_idx`(`prospectId`),
    INDEX `Quote_terrainId_idx`(`terrainId`),
    INDEX `Quote_propertyId_idx`(`propertyId`),
    INDEX `Quote_programmeId_idx`(`programmeId`),
    INDEX `Quote_lotissementId_idx`(`lotissementId`),
    INDEX `Quote_agentId_idx`(`agentId`),
    INDEX `Quote_createdById_idx`(`createdById`),
    INDEX `Quote_templateId_idx`(`templateId`),
    INDEX `Quote_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable : lignes de devis
CREATE TABLE `QuoteItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    `unitPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `order` INTEGER NOT NULL DEFAULT 0,

    INDEX `QuoteItem_quoteId_idx`(`quoteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable : rattachement devis sur CrmActivity et Document
ALTER TABLE `CrmActivity` ADD COLUMN `quoteId` INTEGER NULL;
ALTER TABLE `Document` ADD COLUMN `quoteId` INTEGER NULL;

CREATE INDEX `CrmActivity_quoteId_idx` ON `CrmActivity`(`quoteId`);
CREATE INDEX `Document_quoteId_idx` ON `Document`(`quoteId`);

-- AddForeignKey : Quote
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_prospectId_fkey`
    FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_terrainId_fkey`
    FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_propertyId_fkey`
    FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_programmeId_fkey`
    FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_lotissementId_fkey`
    FOREIGN KEY (`lotissementId`) REFERENCES `Lotissement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_agentId_fkey`
    FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Quote` ADD CONSTRAINT `Quote_templateId_fkey`
    FOREIGN KEY (`templateId`) REFERENCES `QuoteTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey : QuoteItem (cascade à la suppression du devis)
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey`
    FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey : rattachements quoteId
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_quoteId_fkey`
    FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Document` ADD CONSTRAINT `Document_quoteId_fkey`
    FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
