-- Module 19 (suite) — Criblage de masse, Audit/traçabilité & Alertes.
-- Nouveaux modèles AmlWatchlistAlert / AmlScreeningRun / AmlScreeningHit +
-- rattachement optionnel amlWatchlistAlertId sur Document. Rédigé à la main
-- (prisma migrate dev non interactif) et restreint aux seules instructions
-- liées à cet ajout.

-- CreateTable
CREATE TABLE `AmlWatchlistAlert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `source` ENUM('CENTIF_CI', 'SFC', 'ONU', 'UE', 'GIABA', 'AUTRE') NOT NULL DEFAULT 'CENTIF_CI',
    `title` VARCHAR(191) NOT NULL,
    `centifPublicationDate` DATETIME(3) NULL,
    `fileDownloadedAt` DATETIME(3) NULL,
    `integratedAt` DATETIME(3) NULL,
    `operatorId` INTEGER NULL,
    `operatorName` VARCHAR(191) NULL,
    `entriesAdded` INTEGER NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlWatchlistAlert_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlWatchlistAlert_reference_key`(`reference`),
    INDEX `AmlWatchlistAlert_source_idx`(`source`),
    INDEX `AmlWatchlistAlert_integratedAt_idx`(`integratedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlScreeningRun` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `trigger` ENUM('MANUEL', 'ENTITE_AJOUTEE', 'REFERENTIEL_MAJ', 'PLANIFIE') NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'EN_COURS',
    `errorMsg` TEXT NULL,
    `baseAlertId` INTEGER NULL,
    `baseVersionLabel` VARCHAR(191) NULL,
    `watchlistCount` INTEGER NOT NULL DEFAULT 0,
    `scopeClients` BOOLEAN NOT NULL DEFAULT true,
    `scopeProspects` BOOLEAN NOT NULL DEFAULT true,
    `scopeOwners` BOOLEAN NOT NULL DEFAULT true,
    `scopeReferrers` BOOLEAN NOT NULL DEFAULT true,
    `entitiesScreened` INTEGER NOT NULL DEFAULT 0,
    `hitsNew` INTEGER NOT NULL DEFAULT 0,
    `hitsTotal` INTEGER NOT NULL DEFAULT 0,
    `operatorId` INTEGER NULL,
    `operatorName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AmlScreeningRun_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlScreeningRun_reference_key`(`reference`),
    INDEX `AmlScreeningRun_trigger_idx`(`trigger`),
    INDEX `AmlScreeningRun_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlScreeningHit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entityType` ENUM('CLIENT', 'PROSPECT', 'OWNER', 'REFERRER') NOT NULL,
    `entityId` INTEGER NOT NULL,
    `entityLabel` VARCHAR(191) NOT NULL,
    `watchlistId` INTEGER NOT NULL,
    `matchedOn` VARCHAR(191) NOT NULL,
    `matchDetail` TEXT NULL,
    `status` ENUM('A_VERIFIER', 'CONFIRME', 'FAUX_POSITIF') NOT NULL DEFAULT 'A_VERIFIER',
    `stillMatching` BOOLEAN NOT NULL DEFAULT true,
    `runId` INTEGER NULL,
    `lastRunId` INTEGER NULL,
    `firstDetectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastDetectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `amlProfileId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AmlScreeningHit_status_idx`(`status`),
    INDEX `AmlScreeningHit_entityType_entityId_idx`(`entityType`, `entityId`),
    UNIQUE INDEX `AmlScreeningHit_entityType_entityId_watchlistId_key`(`entityType`, `entityId`, `watchlistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `amlWatchlistAlertId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_amlWatchlistAlertId_fkey` FOREIGN KEY (`amlWatchlistAlertId`) REFERENCES `AmlWatchlistAlert`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlWatchlistAlert` ADD CONSTRAINT `AmlWatchlistAlert_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlWatchlistAlert` ADD CONSTRAINT `AmlWatchlistAlert_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlScreeningRun` ADD CONSTRAINT `AmlScreeningRun_baseAlertId_fkey` FOREIGN KEY (`baseAlertId`) REFERENCES `AmlWatchlistAlert`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlScreeningRun` ADD CONSTRAINT `AmlScreeningRun_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlScreeningHit` ADD CONSTRAINT `AmlScreeningHit_watchlistId_fkey` FOREIGN KEY (`watchlistId`) REFERENCES `AmlWatchlist`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlScreeningHit` ADD CONSTRAINT `AmlScreeningHit_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `AmlScreeningRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlScreeningHit` ADD CONSTRAINT `AmlScreeningHit_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
