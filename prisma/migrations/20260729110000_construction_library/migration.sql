-- Module 17 — Moteur de devis de construction (Phase 1) : bibliothèque
-- technique (référentiels, bordereau de prix, ouvrages, coefficients).
-- Aucune dépendance vers les tables transactionnelles (voir la migration
-- suivante 20260729120000_construction_estimates).

-- CreateTable
CREATE TABLE `ConstructionLot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `phase` ENUM('GROS_OEUVRE', 'SECOND_OEUVRE', 'ELECTRICITE', 'PLOMBERIE', 'FINITIONS', 'VRD', 'AMENAGEMENTS') NOT NULL DEFAULT 'GROS_OEUVRE',
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionLot_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionLot_code_key`(`code`),
    INDEX `ConstructionLot_phase_idx`(`phase`),
    INDEX `ConstructionLot_numero_idx`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionResourceFamily` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionResourceFamily_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionLocality` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `priceCoefficient` DECIMAL(6, 3) NOT NULL DEFAULT 1.000,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionLocality_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionResource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` ENUM('MATERIAU', 'MAIN_OEUVRE', 'TRANSPORT', 'MATERIEL', 'SOUS_TRAITANCE') NOT NULL DEFAULT 'MATERIAU',
    `family` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quality` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `priceDate` DATETIME(3) NULL,
    `supplierName` VARCHAR(191) NULL,
    `referenceCity` VARCHAR(191) NULL,
    `priceIsIndicative` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionResource_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionResource_code_key`(`code`),
    INDEX `ConstructionResource_type_idx`(`type`),
    INDEX `ConstructionResource_family_idx`(`family`),
    INDEX `ConstructionResource_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionResourcePriceVariant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `resourceId` INTEGER NOT NULL,
    `localityId` INTEGER NOT NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `supplierName` VARCHAR(191) NULL,
    `quality` VARCHAR(191) NULL,
    `priceDate` DATETIME(3) NULL,
    `note` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConstructionResourcePriceVariant_resourceId_localityId_key`(`resourceId`, `localityId`),
    INDEX `ConstructionResourcePriceVariant_localityId_idx`(`localityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionResourcePriceHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `resourceId` INTEGER NOT NULL,
    `localityId` INTEGER NULL,
    `previousPrice` DECIMAL(15, 2) NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL,
    `variationPct` DECIMAL(8, 2) NULL,
    `effectiveDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `supplierName` VARCHAR(191) NULL,
    `quality` VARCHAR(191) NULL,
    `source` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `changedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConstructionResourcePriceHistory_resourceId_idx`(`resourceId`),
    INDEX `ConstructionResourcePriceHistory_effectiveDate_idx`(`effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionWorkItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `lotId` INTEGER NOT NULL,
    `designation` TEXT NOT NULL,
    `description` TEXT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `formulaCode` VARCHAR(191) NULL,
    `fixedQuantity` DECIMAL(12, 3) NULL,
    `quantityMultiplier` DECIMAL(10, 4) NOT NULL DEFAULT 1,
    `applicabilityRule` JSON NULL,
    `percentOfTotalPct` DECIMAL(6, 3) NULL,
    `deboursSecOverride` DECIMAL(15, 4) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionWorkItem_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionWorkItem_code_key`(`code`),
    INDEX `ConstructionWorkItem_lotId_idx`(`lotId`),
    INDEX `ConstructionWorkItem_formulaCode_idx`(`formulaCode`),
    INDEX `ConstructionWorkItem_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionWorkItemComponent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workItemId` INTEGER NOT NULL,
    `resourceId` INTEGER NOT NULL,
    `quantityPerUnit` DECIMAL(14, 5) NOT NULL,
    `wastageRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConstructionWorkItemComponent_workItemId_resourceId_key`(`workItemId`, `resourceId`),
    INDEX `ConstructionWorkItemComponent_resourceId_idx`(`resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionRatioDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `defaultValue` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `minValue` DECIMAL(12, 4) NULL,
    `maxValue` DECIMAL(12, 4) NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionRatioDefinition_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionRatioDefinition_code_key`(`code`),
    INDEX `ConstructionRatioDefinition_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionRatioProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `buildingType` ENUM('VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS', 'BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE') NOT NULL,
    `standing` ENUM('ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE') NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ConstructionRatioProfile_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionRatioProfile_buildingType_standing_key`(`buildingType`, `standing`),
    INDEX `ConstructionRatioProfile_buildingType_idx`(`buildingType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionRatioValue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `ratioDefinitionId` INTEGER NOT NULL,
    `value` DECIMAL(12, 4) NOT NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `ConstructionRatioValue_profileId_ratioDefinitionId_key`(`profileId`, `ratioDefinitionId`),
    INDEX `ConstructionRatioValue_ratioDefinitionId_idx`(`ratioDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConstructionResourcePriceVariant` ADD CONSTRAINT `ConstructionResourcePriceVariant_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ConstructionResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConstructionResourcePriceVariant` ADD CONSTRAINT `ConstructionResourcePriceVariant_localityId_fkey` FOREIGN KEY (`localityId`) REFERENCES `ConstructionLocality`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionResourcePriceHistory` ADD CONSTRAINT `ConstructionResourcePriceHistory_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ConstructionResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConstructionResourcePriceHistory` ADD CONSTRAINT `ConstructionResourcePriceHistory_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionWorkItem` ADD CONSTRAINT `ConstructionWorkItem_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `ConstructionLot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionWorkItemComponent` ADD CONSTRAINT `ConstructionWorkItemComponent_workItemId_fkey` FOREIGN KEY (`workItemId`) REFERENCES `ConstructionWorkItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConstructionWorkItemComponent` ADD CONSTRAINT `ConstructionWorkItemComponent_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `ConstructionResource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionRatioValue` ADD CONSTRAINT `ConstructionRatioValue_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `ConstructionRatioProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ConstructionRatioValue` ADD CONSTRAINT `ConstructionRatioValue_ratioDefinitionId_fkey` FOREIGN KEY (`ratioDefinitionId`) REFERENCES `ConstructionRatioDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
