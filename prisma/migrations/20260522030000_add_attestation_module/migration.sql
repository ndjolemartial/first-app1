-- ════════════════════════════════════════════════════════════════════
-- Migration : ajout du module Attestations (modèles + attestations émises)
-- ════════════════════════════════════════════════════════════════════
-- Crée deux tables :
--   AttestationTemplate — modèle paramétrable (header/body/footer HTML)
--   Attestation         — instance émise pour un client (référence ATT-YYYY-NNNN)
-- Types : ATTRIBUTION, CESSION, SOLDE, TRANSFERT_PROPRIETE
-- ════════════════════════════════════════════════════════════════════

-- CreateTable : modèles d'attestation enrichis
CREATE TABLE `AttestationTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ATTRIBUTION', 'CESSION', 'SOLDE', 'TRANSFERT_PROPRIETE') NOT NULL,
    `header` LONGTEXT NULL,
    `body` LONGTEXT NOT NULL,
    `footer` LONGTEXT NULL,
    `headerWidth` INTEGER NOT NULL DEFAULT 100,
    `footerWidth` INTEGER NOT NULL DEFAULT 100,
    `headerHeight` INTEGER NOT NULL DEFAULT 140,
    `footerHeight` INTEGER NOT NULL DEFAULT 140,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AttestationTemplate_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable : attestations émises
CREATE TABLE `Attestation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `type` ENUM('ATTRIBUTION', 'CESSION', 'SOLDE', 'TRANSFERT_PROPRIETE') NOT NULL,
    `clientId` INTEGER NOT NULL,
    `secondaryClientId` INTEGER NULL,
    `terrainId` INTEGER NULL,
    `propertyId` INTEGER NULL,
    `conventionId` INTEGER NULL,
    `templateId` INTEGER NULL,
    `emittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `emittedById` INTEGER NULL,
    `amount` DECIMAL(15, 2) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Attestation_uuid_key`(`uuid`),
    UNIQUE INDEX `Attestation_reference_key`(`reference`),
    INDEX `Attestation_clientId_idx`(`clientId`),
    INDEX `Attestation_secondaryClientId_idx`(`secondaryClientId`),
    INDEX `Attestation_terrainId_idx`(`terrainId`),
    INDEX `Attestation_propertyId_idx`(`propertyId`),
    INDEX `Attestation_conventionId_idx`(`conventionId`),
    INDEX `Attestation_templateId_idx`(`templateId`),
    INDEX `Attestation_emittedById_idx`(`emittedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_clientId_fkey`
    FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_secondaryClientId_fkey`
    FOREIGN KEY (`secondaryClientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_terrainId_fkey`
    FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_propertyId_fkey`
    FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_conventionId_fkey`
    FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_templateId_fkey`
    FOREIGN KEY (`templateId`) REFERENCES `AttestationTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Attestation`
    ADD CONSTRAINT `Attestation_emittedById_fkey`
    FOREIGN KEY (`emittedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
