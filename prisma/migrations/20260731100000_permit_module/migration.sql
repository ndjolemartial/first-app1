-- Module 18 — Moteur de devis de permis de construire. Bibliothèque
-- (communes, catalogue de prestations/frais/taxes, surcharges de taux,
-- tranches de surface) + couche transactionnelle (projet, estimations,
-- lignes). Réutilise l'enum ConstructionStanding existant (pas de doublon).

-- CreateTable
CREATE TABLE `PermitCommune` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NULL,
    `region` VARCHAR(191) NULL,
    `zoneType` ENUM('URBAINE', 'RURALE') NOT NULL DEFAULT 'URBAINE',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PermitCommune_uuid_key`(`uuid`),
    INDEX `PermitCommune_nom_idx`(`nom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermitFeeItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `category` ENUM('ARCHITECTE', 'BET_STRUCTURE', 'BET_FLUIDES', 'BET_ELECTRICITE', 'BET_VRD', 'BET_GEOTECHNIQUE', 'GEOMETRE', 'ETUDE_SOL', 'ETUDE_HYDROLOGIE', 'ETUDE_ENVIRONNEMENT', 'ETUDE_INCENDIE', 'FRAIS_ADMINISTRATIF', 'TAXE') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `calcMode` ENUM('POURCENTAGE_COUT_TRAVAUX', 'FORFAIT', 'PAR_M2_TERRAIN', 'PAR_M2_BATI', 'BAREME_SURFACE') NOT NULL,
    `missionPhase` ENUM('ESQUISSE', 'APS', 'APD', 'PLANS_EXECUTION', 'SUIVI_CHANTIER', 'RECEPTION') NULL,
    `defaultValue` DECIMAL(15, 4) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `applicabilityRule` JSON NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PermitFeeItem_uuid_key`(`uuid`),
    UNIQUE INDEX `PermitFeeItem_code_key`(`code`),
    INDEX `PermitFeeItem_category_idx`(`category`),
    INDEX `PermitFeeItem_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermitFeeRateOverride` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `feeItemId` INTEGER NOT NULL,
    `nature` ENUM('VILLA', 'IMMEUBLE', 'COMMERCE', 'BUREAU', 'HOTEL', 'USINE', 'ENTREPOT') NULL,
    `standing` ENUM('ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE') NULL,
    `communeId` INTEGER NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PermitFeeRateOverride_feeItemId_nature_standing_communeId_key`(`feeItemId`, `nature`, `standing`, `communeId`),
    INDEX `PermitFeeRateOverride_communeId_idx`(`communeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermitFeeSurfaceBracket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `feeItemId` INTEGER NOT NULL,
    `minSurface` DECIMAL(12, 2) NOT NULL,
    `maxSurface` DECIMAL(12, 2) NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `label` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `PermitFeeSurfaceBracket_feeItemId_idx`(`feeItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermitProject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `status` ENUM('BROUILLON', 'ESTIME', 'DEVIS_EMIS', 'ARCHIVE') NOT NULL DEFAULT 'BROUILLON',
    `clientId` INTEGER NULL,
    `prospectId` INTEGER NULL,
    `agentId` INTEGER NULL,
    `constructionProjectId` INTEGER NULL,
    `nature` ENUM('VILLA', 'IMMEUBLE', 'COMMERCE', 'BUREAU', 'HOTEL', 'USINE', 'ENTREPOT') NOT NULL,
    `standing` ENUM('ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE') NOT NULL DEFAULT 'MOYEN_STANDING',
    `communeId` INTEGER NULL,
    `zoneType` ENUM('URBAINE', 'RURALE') NULL,
    `terrainSurface` DECIMAL(12, 2) NULL,
    `surfaceBatie` DECIMAL(12, 2) NOT NULL,
    `levels` INTEGER NOT NULL DEFAULT 1,
    `hasSousSol` BOOLEAN NOT NULL DEFAULT false,
    `nombreBatiments` INTEGER NOT NULL DEFAULT 1,
    `coutPrevisionnelTravaux` DECIMAL(15, 2) NULL,
    `hasPiscine` BOOLEAN NOT NULL DEFAULT false,
    `hasAscenseur` BOOLEAN NOT NULL DEFAULT false,
    `hasGroupeElectrogene` BOOLEAN NOT NULL DEFAULT false,
    `hasForage` BOOLEAN NOT NULL DEFAULT false,
    `hasCloture` BOOLEAN NOT NULL DEFAULT false,
    `hasVoirieInterieure` BOOLEAN NOT NULL DEFAULT false,
    `missionPhases` JSON NOT NULL,
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PermitProject_uuid_key`(`uuid`),
    UNIQUE INDEX `PermitProject_reference_key`(`reference`),
    INDEX `PermitProject_clientId_idx`(`clientId`),
    INDEX `PermitProject_prospectId_idx`(`prospectId`),
    INDEX `PermitProject_status_idx`(`status`),
    INDEX `PermitProject_communeId_idx`(`communeId`),
    INDEX `PermitProject_constructionProjectId_idx`(`constructionProjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermitEstimate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('BROUILLON', 'VALIDE', 'CONVERTI', 'OBSOLETE') NOT NULL DEFAULT 'BROUILLON',
    `totalArchitecte` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalBET` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalGeometre` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalEtudes` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalFraisAdministratifs` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTaxes` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalHT` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTVA` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTTC` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tvaPct` DECIMAL(5, 2) NOT NULL DEFAULT 18,
    `coutPrevisionnelTravauxSnapshot` DECIMAL(15, 2) NULL,
    `warnings` JSON NULL,
    `quoteId` INTEGER NULL,
    `quoteReference` VARCHAR(191) NULL,
    `convertedAt` DATETIME(3) NULL,
    `generatedById` INTEGER NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PermitEstimate_uuid_key`(`uuid`),
    UNIQUE INDEX `PermitEstimate_reference_key`(`reference`),
    UNIQUE INDEX `PermitEstimate_projectId_version_key`(`projectId`, `version`),
    INDEX `PermitEstimate_projectId_idx`(`projectId`),
    INDEX `PermitEstimate_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermitEstimateLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estimateId` INTEGER NOT NULL,
    `feeItemId` INTEGER NULL,
    `feeItemCode` VARCHAR(191) NULL,
    `category` ENUM('ARCHITECTE', 'BET_STRUCTURE', 'BET_FLUIDES', 'BET_ELECTRICITE', 'BET_VRD', 'BET_GEOTECHNIQUE', 'GEOMETRE', 'ETUDE_SOL', 'ETUDE_HYDROLOGIE', 'ETUDE_ENVIRONNEMENT', 'ETUDE_INCENDIE', 'FRAIS_ADMINISTRATIF', 'TAXE') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `calcMode` ENUM('POURCENTAGE_COUT_TRAVAUX', 'FORFAIT', 'PAR_M2_TERRAIN', 'PAR_M2_BATI', 'BAREME_SURFACE') NOT NULL,
    `baseAmount` DECIMAL(15, 2) NULL,
    `rateValue` DECIMAL(15, 4) NOT NULL,
    `montantHT` DECIMAL(15, 2) NOT NULL,
    `trace` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PermitEstimateLine_estimateId_idx`(`estimateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PermitFeeRateOverride` ADD CONSTRAINT `PermitFeeRateOverride_feeItemId_fkey` FOREIGN KEY (`feeItemId`) REFERENCES `PermitFeeItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PermitFeeRateOverride` ADD CONSTRAINT `PermitFeeRateOverride_communeId_fkey` FOREIGN KEY (`communeId`) REFERENCES `PermitCommune`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermitFeeSurfaceBracket` ADD CONSTRAINT `PermitFeeSurfaceBracket_feeItemId_fkey` FOREIGN KEY (`feeItemId`) REFERENCES `PermitFeeItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermitProject` ADD CONSTRAINT `PermitProject_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PermitProject` ADD CONSTRAINT `PermitProject_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PermitProject` ADD CONSTRAINT `PermitProject_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PermitProject` ADD CONSTRAINT `PermitProject_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PermitProject` ADD CONSTRAINT `PermitProject_communeId_fkey` FOREIGN KEY (`communeId`) REFERENCES `PermitCommune`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PermitProject` ADD CONSTRAINT `PermitProject_constructionProjectId_fkey` FOREIGN KEY (`constructionProjectId`) REFERENCES `ConstructionProject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermitEstimate` ADD CONSTRAINT `PermitEstimate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `PermitProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PermitEstimate` ADD CONSTRAINT `PermitEstimate_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermitEstimateLine` ADD CONSTRAINT `PermitEstimateLine_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `PermitEstimate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
