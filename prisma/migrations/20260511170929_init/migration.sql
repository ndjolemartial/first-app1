-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `matricule` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'AGENT', 'ACCOUNTANT', 'READONLY') NOT NULL DEFAULT 'AGENT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `avatar` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_uuid_key`(`uuid`),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prospect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `source` ENUM('SITE_WEB_AFRIKIMMO', 'RECOMMENDATION', 'TELEPHONE', 'RESEAUX_SOCIAUX', 'EMAIL', 'CONTACT_PERSONNEL', 'AUTRE', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `status` ENUM('NOUVEAU', 'CONTACTE', 'QUALIFIE', 'ENVOI_PROPOSITION', 'NEGOCIATION_EN_COURS', 'CONVERTI', 'PERDU') NOT NULL DEFAULT 'NOUVEAU',
    `budget` DECIMAL(15, 2) NULL,
    `notes` TEXT NULL,
    `assignedToId` INTEGER NULL,
    `convertedAt` DATETIME(3) NULL,
    `clientId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Prospect_uuid_key`(`uuid`),
    UNIQUE INDEX `Prospect_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `type` ENUM('INDIVIDUEL', 'ENTREPRISE') NOT NULL DEFAULT 'INDIVIDUEL',
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `civilite` ENUM('CELIBATAIRE', 'MARIE', 'CONCUBINAGE') NOT NULL DEFAULT 'CELIBATAIRE',
    `entreprise` VARCHAR(191) NULL,
    `registre_de_commerce` VARCHAR(191) NULL,
    `compte_contribuable` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'CI',
    `nationality` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `idNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Client_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Owner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `type` ENUM('INDIVIDUEL', 'ENTREPRISE') NOT NULL DEFAULT 'INDIVIDUEL',
    `firstName` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NULL,
    `companyName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'CI',
    `bankIban` VARCHAR(191) NULL,
    `bankBic` VARCHAR(191) NULL,
    `compte_contribuable` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Owner_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Property` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `type` ENUM('TERRAIN', 'APARTEMENT', 'DUPLEX', 'VILLA', 'STUDIO', 'BUREAU', 'PARKING', 'AUTRE') NOT NULL,
    `status` ENUM('DISPONIBLE', 'INDISPONIBLE', 'EN_LOCATION', 'SOLDE', 'SOUS_OPTION', 'EN_RENOVATION') NOT NULL DEFAULT 'DISPONIBLE',
    `ownerId` INTEGER NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `postalCode` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'CI',
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `surface` DECIMAL(10, 2) NOT NULL,
    `surfaceCarrez` DECIMAL(10, 2) NULL,
    `rooms` INTEGER NULL,
    `bedrooms` INTEGER NULL,
    `bathrooms` INTEGER NULL,
    `floor` INTEGER NULL,
    `totalFloors` INTEGER NULL,
    `buildYear` INTEGER NULL,
    `condition` ENUM('NOUVEAU', 'EXCELLENT', 'BON', 'MOYEN', 'MAUVAIS') NULL,
    `rentPrice` DECIMAL(15, 2) NULL,
    `salePrice` DECIMAL(15, 2) NULL,
    `charges` DECIMAL(15, 2) NULL,
    `taxeFonciere` DECIMAL(15, 2) NULL,
    `description` TEXT NULL,
    `amenities` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Property_uuid_key`(`uuid`),
    UNIQUE INDEX `Property_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PropertyPhoto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `propertyId` INTEGER NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE') NOT NULL,
    `status` ENUM('BROUILLON', 'ACTIVE', 'EXPIRE', 'TERMINER', 'ANNULE', 'ATTENTE_SIGNATURE') NOT NULL DEFAULT 'BROUILLON',
    `propertyId` INTEGER NOT NULL,
    `clientId` INTEGER NOT NULL,
    `agentId` INTEGER NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `signedAt` DATETIME(3) NULL,
    `rentAmount` DECIMAL(15, 2) NULL,
    `saleAmount` DECIMAL(15, 2) NULL,
    `deposit` DECIMAL(15, 2) NULL,
    `agencyFees` DECIMAL(15, 2) NULL,
    `charges` DECIMAL(15, 2) NULL,
    `paymentDay` INTEGER NULL,
    `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY') NOT NULL DEFAULT 'ESPECE',
    `paymentModalites` ENUM('CASH', 'SUR_3_MOIS', 'SUR_6_MOIS', 'SUR_9_MOIS', 'SUR_12_MOIS', 'SUR_24_MOIS', 'SUR_36_MOIS', 'SUR_48_MOIS', 'SUR_60_MOIS', 'SUR_PLUS_60_MOIS') NOT NULL DEFAULT 'CASH',
    `installmentCount` INTEGER NULL,
    `installmentAmount` DECIMAL(15, 2) NULL,
    `firstInstallmentDate` DATETIME(3) NULL,
    `lastInstallmentDate` DATETIME(3) NULL,
    `indexType` VARCHAR(191) NULL,
    `lastRevisionAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Contract_uuid_key`(`uuid`),
    UNIQUE INDEX `Contract_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `type` ENUM('VENTE', 'ECHEANCE_VENTE', 'FRAIS_AGENCE', 'FRAIS_DE_GESTION', 'AVANCE', 'CAUTION', 'OTHER') NOT NULL,
    `status` ENUM('BROUILLON', 'ENVOYEE', 'PAYEE', 'PARTIEL', 'EN_RETARD', 'ANNULEE') NOT NULL DEFAULT 'BROUILLON',
    `clientId` INTEGER NULL,
    `contractId` INTEGER NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(15, 2) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `issueDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Invoice_uuid_key`(`uuid`),
    UNIQUE INDEX `Invoice_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoiceId` INTEGER NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `method` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY') NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaleInstallment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('EN_ATTENTE', 'A_REGLER', 'PAYE', 'EN_RETARD', 'ANNULE') NOT NULL DEFAULT 'EN_ATTENTE',
    `paidAt` DATETIME(3) NULL,
    `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY') NULL,
    `paymentRef` VARCHAR(191) NULL,
    `invoiceId` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CrmActivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('NOTIFICATION', 'APPEL', 'EMAIL', 'SMS', 'REUNION', 'VISITE', 'TASK', 'RAPPEL', 'DOCUMENT') NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('EN_ATTENTE', 'EN_TRAITEMENT', 'TRAITE', 'ANNULE') NOT NULL DEFAULT 'EN_ATTENTE',
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `userId` INTEGER NULL,
    `prospectId` INTEGER NULL,
    `clientId` INTEGER NULL,
    `ownerId` INTEGER NULL,
    `propertyId` INTEGER NULL,
    `contractId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Communication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel` ENUM('EMAIL', 'SMS') NOT NULL,
    `direction` ENUM('ENTRANT', 'SORTANT') NOT NULL DEFAULT 'SORTANT',
    `to` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('EN_ATTENTE', 'ENVOYE', 'RECU', 'ECHEC', 'REFUSE') NOT NULL DEFAULT 'EN_ATTENTE',
    `sentAt` DATETIME(3) NULL,
    `errorMsg` VARCHAR(191) NULL,
    `templateId` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL', 'SMS') NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `variables` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `category` VARCHAR(191) NULL,
    `clientId` INTEGER NULL,
    `ownerId` INTEGER NULL,
    `propertyId` INTEGER NULL,
    `contractId` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProspectTag` (
    `prospectId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    PRIMARY KEY (`prospectId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArchiveRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `entityType` ENUM('CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONTRACT', 'INVOICE', 'DOCUMENT') NOT NULL,
    `entityId` INTEGER NOT NULL,
    `entityRef` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `reason` ENUM('MANUEL', 'CONTRAT_TERMINE', 'CLIENT_INACTIF', 'BIEN_VENDU', 'POLITIQUE_AUTOMATIQUE', 'DEMANDE_RGPD', 'AUTRE') NOT NULL DEFAULT 'MANUEL',
    `reasonDetail` TEXT NULL,
    `archivedById` INTEGER NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `restoredById` INTEGER NULL,
    `restoredAt` DATETIME(3) NULL,
    `status` ENUM('ARCHIVE', 'RESTAURE', 'SUPPRIME_DEFINITIVEMENT') NOT NULL DEFAULT 'ARCHIVE',
    `retentionDate` DATETIME(3) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `ArchiveRecord_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArchivePolicy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `entityType` ENUM('CLIENT', 'PROSPECT', 'OWNER', 'PROPERTY', 'CONTRACT', 'INVOICE', 'DOCUMENT') NOT NULL,
    `triggerCondition` JSON NOT NULL,
    `retentionDays` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Property` ADD CONSTRAINT `Property_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PropertyPhoto` ADD CONSTRAINT `PropertyPhoto_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleInstallment` ADD CONSTRAINT `SaleInstallment_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleInstallment` ADD CONSTRAINT `SaleInstallment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `CommTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProspectTag` ADD CONSTRAINT `ProspectTag_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProspectTag` ADD CONSTRAINT `ProspectTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArchiveRecord` ADD CONSTRAINT `ArchiveRecord_archivedById_fkey` FOREIGN KEY (`archivedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArchiveRecord` ADD CONSTRAINT `ArchiveRecord_restoredById_fkey` FOREIGN KEY (`restoredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
