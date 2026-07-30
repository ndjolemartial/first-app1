-- Module 17 — Moteur de devis de construction (Phase 1) : couche
-- transactionnelle (projet, estimations, lignes de DQE, quantitatif de
-- ressources). Dépend de la migration précédente 20260729110000_construction_library.

-- CreateTable
CREATE TABLE `ConstructionProject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NOT NULL,
    `status` ENUM('BROUILLON', 'ESTIME', 'DEVIS_EMIS', 'ARCHIVE') NOT NULL DEFAULT 'BROUILLON',
    `clientId` INTEGER NULL,
    `prospectId` INTEGER NULL,
    `terrainId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `agentId` INTEGER NULL,
    `buildingType` ENUM('VILLA_BASSE', 'VILLA_DUPLEX', 'VILLA_TRIPLEX', 'MAISON_ECONOMIQUE', 'IMMEUBLE_R_PLUS', 'BUREAU', 'COMMERCE', 'ENTREPOT_HANGAR', 'AUTRE') NOT NULL DEFAULT 'VILLA_BASSE',
    `standing` ENUM('ECONOMIQUE', 'STANDARD', 'MOYEN_STANDING', 'HAUT_STANDING', 'LUXE') NOT NULL DEFAULT 'MOYEN_STANDING',
    `levels` INTEGER NOT NULL DEFAULT 1,
    `roomCount` INTEGER NOT NULL DEFAULT 1,
    `livingRoomCount` INTEGER NOT NULL DEFAULT 1,
    `bedroomCount` INTEGER NOT NULL DEFAULT 0,
    `bathroomCount` INTEGER NOT NULL DEFAULT 0,
    `showerRoomCount` INTEGER NOT NULL DEFAULT 0,
    `wcCount` INTEGER NOT NULL DEFAULT 0,
    `surfaceHabitable` DECIMAL(10, 2) NOT NULL,
    `surfaceConstruite` DECIMAL(10, 2) NULL,
    `kitchenType` ENUM('NUE', 'SIMPLE_PAILLASSE', 'EQUIPEE_STANDARD', 'EQUIPEE_HAUT_DE_GAMME') NOT NULL DEFAULT 'EQUIPEE_STANDARD',
    `roofType` ENUM('DALLE_PLEINE', 'CHARPENTE_BOIS_TOLE', 'CHARPENTE_BOIS_TUILE', 'CHARPENTE_METALLIQUE_BAC', 'MIXTE_DALLE_CHARPENTE') NOT NULL DEFAULT 'DALLE_PLEINE',
    `joineryType` ENUM('ALUMINIUM_STANDARD', 'ALUMINIUM_VITRAGE_TEINTE', 'PVC', 'BOIS_MASSIF', 'METALLIQUE', 'MIXTE_ALU_BOIS') NOT NULL DEFAULT 'ALUMINIUM_STANDARD',
    `interiorJoineryType` ENUM('ALUMINIUM_STANDARD', 'ALUMINIUM_VITRAGE_TEINTE', 'PVC', 'BOIS_MASSIF', 'METALLIQUE', 'MIXTE_ALU_BOIS') NULL,
    `flooringType` ENUM('CHAPE_LISSEE', 'CARRELAGE_GRES_STANDARD', 'CARRELAGE_GRES_CERAME', 'GRANITO', 'MARBRE', 'PARQUET_BOIS', 'MIXTE') NOT NULL DEFAULT 'CARRELAGE_GRES_STANDARD',
    `acType` ENUM('AUCUNE', 'VENTILATION_SEULE', 'SPLIT_PARTIEL', 'SPLIT_TOUTES_PIECES', 'GAINABLE_CENTRALISE') NOT NULL DEFAULT 'SPLIT_PARTIEL',
    `acRoomCount` INTEGER NULL,
    `hasFalseCeiling` BOOLEAN NOT NULL DEFAULT false,
    `terrainType` ENUM('PLAT', 'LEGERE_PENTE', 'FORTE_PENTE', 'MARECAGEUX_REMBLAI', 'ROCHEUX') NOT NULL DEFAULT 'PLAT',
    `terrainSurface` DECIMAL(10, 2) NULL,
    `localityId` INTEGER NULL,
    `ville` VARCHAR(191) NULL,
    `commune` VARCHAR(191) NULL,
    `quartier` VARCHAR(191) NULL,
    `sanitationType` ENUM('FOSSE_SEPTIQUE_PUISARD', 'FOSSE_TOUTES_EAUX_EPANDAGE', 'MICRO_STATION', 'RACCORDEMENT_RESEAU_COLLECTIF', 'AUCUN') NOT NULL DEFAULT 'FOSSE_SEPTIQUE_PUISARD',
    `hasWaterConnection` BOOLEAN NOT NULL DEFAULT true,
    `hasElectricityConnection` BOOLEAN NOT NULL DEFAULT true,
    `fenceLength` DECIMAL(10, 2) NULL,
    `fenceHeight` DECIMAL(5, 2) NULL,
    `gateCount` INTEGER NOT NULL DEFAULT 0,
    `hasPool` BOOLEAN NOT NULL DEFAULT false,
    `poolSurface` DECIMAL(10, 2) NULL,
    `hasExteriorLayout` BOOLEAN NOT NULL DEFAULT false,
    `exteriorPavedSurface` DECIMAL(10, 2) NULL,
    `hasLandscaping` BOOLEAN NOT NULL DEFAULT false,
    `fraisChantierPct` DECIMAL(5, 2) NULL,
    `fraisGenerauxPct` DECIMAL(5, 2) NULL,
    `margePct` DECIMAL(5, 2) NULL,
    `tvaPct` DECIMAL(5, 2) NULL,
    `markupMode` ENUM('CASCADE', 'ADDITIF') NULL,
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionProject_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionProject_reference_key`(`reference`),
    INDEX `ConstructionProject_clientId_idx`(`clientId`),
    INDEX `ConstructionProject_prospectId_idx`(`prospectId`),
    INDEX `ConstructionProject_status_idx`(`status`),
    INDEX `ConstructionProject_buildingType_standing_idx`(`buildingType`, `standing`),
    INDEX `ConstructionProject_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionEstimate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `projectId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `precisionLevel` ENUM('NIVEAU_1', 'NIVEAU_2', 'NIVEAU_3') NOT NULL DEFAULT 'NIVEAU_2',
    `status` ENUM('BROUILLON', 'VALIDE', 'CONVERTI', 'OBSOLETE') NOT NULL DEFAULT 'BROUILLON',
    `label` VARCHAR(191) NULL,
    `ratioProfileId` INTEGER NULL,
    `ratioProfileName` VARCHAR(191) NULL,
    `ratioSnapshot` JSON NULL,
    `localityId` INTEGER NULL,
    `localityLabel` VARCHAR(191) NULL,
    `markupMode` ENUM('CASCADE', 'ADDITIF') NOT NULL DEFAULT 'CASCADE',
    `fraisChantierPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `fraisGenerauxPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `margePct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tvaPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `puRoundingStep` INTEGER NOT NULL DEFAULT 1,
    `totalDeboursMateriaux` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDeboursMainOeuvre` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDeboursTransport` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDeboursAutres` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalDeboursSec` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalFraisChantier` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalFraisGeneraux` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalMarge` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalHT` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTVA` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `totalTTC` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `prixMoyenM2` DECIMAL(15, 2) NULL,
    `toleranceRangePct` DECIMAL(5, 2) NULL,
    `budgetMin` DECIMAL(15, 2) NULL,
    `budgetMax` DECIMAL(15, 2) NULL,
    `coveragePct` DECIMAL(5, 2) NULL,
    `warnings` JSON NULL,
    `quoteId` INTEGER NULL,
    `quoteReference` VARCHAR(191) NULL,
    `convertedAt` DATETIME(3) NULL,
    `generatedById` INTEGER NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ConstructionEstimate_uuid_key`(`uuid`),
    UNIQUE INDEX `ConstructionEstimate_reference_key`(`reference`),
    UNIQUE INDEX `ConstructionEstimate_projectId_version_key`(`projectId`, `version`),
    INDEX `ConstructionEstimate_projectId_idx`(`projectId`),
    INDEX `ConstructionEstimate_precisionLevel_idx`(`precisionLevel`),
    INDEX `ConstructionEstimate_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionEstimateLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estimateId` INTEGER NOT NULL,
    `lotId` INTEGER NULL,
    `lotCode` VARCHAR(191) NOT NULL,
    `lotLabel` VARCHAR(191) NOT NULL,
    `lotNumero` INTEGER NOT NULL DEFAULT 0,
    `lotPhase` ENUM('GROS_OEUVRE', 'SECOND_OEUVRE', 'ELECTRICITE', 'PLOMBERIE', 'FINITIONS', 'VRD', 'AMENAGEMENTS') NOT NULL DEFAULT 'GROS_OEUVRE',
    `workItemId` INTEGER NULL,
    `workItemCode` VARCHAR(191) NULL,
    `designation` TEXT NOT NULL,
    `unit` VARCHAR(191) NULL,
    `computedQuantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `overriddenQuantity` DECIMAL(14, 3) NULL,
    `isOverridden` BOOLEAN NOT NULL DEFAULT false,
    `overrideNote` TEXT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL DEFAULT 0,
    `deboursMateriaux` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `deboursMainOeuvre` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `deboursTransport` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `deboursAutres` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `deboursSecUnitaire` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `fraisChantierUnit` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `fraisGenerauxUnit` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `margeUnit` DECIMAL(15, 4) NOT NULL DEFAULT 0,
    `prixUnitaireHT` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `montantHT` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `formulaCode` VARCHAR(191) NULL,
    `formulaTrace` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConstructionEstimateLine_estimateId_idx`(`estimateId`),
    INDEX `ConstructionEstimateLine_workItemId_idx`(`workItemId`),
    INDEX `ConstructionEstimateLine_lotCode_idx`(`lotCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConstructionEstimateResourceLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estimateId` INTEGER NOT NULL,
    `resourceId` INTEGER NULL,
    `resourceCode` VARCHAR(191) NOT NULL,
    `resourceLabel` VARCHAR(191) NOT NULL,
    `resourceType` ENUM('MATERIAU', 'MAIN_OEUVRE', 'TRANSPORT', 'MATERIEL', 'SOUS_TRAITANCE') NOT NULL DEFAULT 'MATERIAU',
    `family` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `quantityNette` DECIMAL(16, 3) NOT NULL DEFAULT 0,
    `quantity` DECIMAL(16, 3) NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `montant` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ConstructionEstimateResourceLine_estimateId_resourceCode_key`(`estimateId`, `resourceCode`),
    INDEX `ConstructionEstimateResourceLine_estimateId_resourceType_idx`(`estimateId`, `resourceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_terrainId_fkey` FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ConstructionProject` ADD CONSTRAINT `ConstructionProject_localityId_fkey` FOREIGN KEY (`localityId`) REFERENCES `ConstructionLocality`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionEstimate` ADD CONSTRAINT `ConstructionEstimate_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `ConstructionProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ConstructionEstimate` ADD CONSTRAINT `ConstructionEstimate_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionEstimateLine` ADD CONSTRAINT `ConstructionEstimateLine_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `ConstructionEstimate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConstructionEstimateResourceLine` ADD CONSTRAINT `ConstructionEstimateResourceLine_estimateId_fkey` FOREIGN KEY (`estimateId`) REFERENCES `ConstructionEstimate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
