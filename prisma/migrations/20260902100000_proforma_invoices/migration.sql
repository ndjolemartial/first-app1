-- Factures Proforma : document optionnel, non comptable, généré avant un
-- achat de terrain/bien (à la demande d'un client/prospect, ex. justificatif
-- de décaissement bancaire) — instantané figé, découplé de toute FK vers
-- Quote/Convention/Client/Prospect (même principe que Quote.convertedConventionId).
CREATE TABLE `ProformaInvoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('QUOTE', 'CONVENTION') NOT NULL,
    `quoteId` INTEGER NULL,
    `quoteReference` VARCHAR(191) NULL,
    `conventionId` INTEGER NULL,
    `conventionReference` VARCHAR(191) NULL,
    `clientId` INTEGER NULL,
    `prospectId` INTEGER NULL,
    `recipientLabel` VARCHAR(191) NOT NULL,
    `recipientPhone` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `designation` TEXT NOT NULL,
    `items` JSON NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 2) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProformaInvoice_uuid_key`(`uuid`),
    UNIQUE INDEX `ProformaInvoice_reference_key`(`reference`),
    INDEX `ProformaInvoice_quoteId_idx`(`quoteId`),
    INDEX `ProformaInvoice_conventionId_idx`(`conventionId`),
    INDEX `ProformaInvoice_clientId_idx`(`clientId`),
    INDEX `ProformaInvoice_prospectId_idx`(`prospectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
