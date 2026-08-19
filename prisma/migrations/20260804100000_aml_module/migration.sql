-- Module 19 — Conformité LBC/FT/FP
-- Nouveau rôle CONFORMITE + 8 nouveaux modèles Aml* + 3 rattachements
-- optionnels sur Document. Généré via `prisma migrate diff --from-url ...
-- --to-schema-datamodel prisma/schema.prisma --script` puis restreint aux
-- seules instructions liées à ce module (le diff brut incluait aussi des
-- dérives de schéma préexistantes et sans rapport — Commission/SaleInstallment/
-- ProjectPhoto/DocumentFolderAccess FKs, Project/ProjectType/ReminderRule —
-- volontairement exclues ici, à traiter séparément si nécessaire).

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'ASSISTANTE_DIRECTION', 'AGENT', 'AGENT_TECHNIQUE', 'RH', 'CONFORMITE', 'READONLY') NOT NULL DEFAULT 'AGENT';

-- CreateTable
CREATE TABLE `AmlRiskFactorCatalog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,
    `isAutoDetected` BOOLEAN NOT NULL DEFAULT false,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlRiskFactorCatalog_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlWatchlist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `listType` ENUM('ONU', 'UE', 'NATIONALE', 'GIABA', 'AUTRE') NOT NULL,
    `personType` ENUM('PHYSIQUE', 'MORALE') NOT NULL DEFAULT 'PHYSIQUE',
    `name` VARCHAR(191) NOT NULL,
    `aliases` JSON NULL,
    `nationality` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `sourceRef` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlWatchlist_uuid_key`(`uuid`),
    INDEX `AmlWatchlist_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `riskScore` INTEGER NOT NULL DEFAULT 0,
    `riskLevel` ENUM('FAIBLE', 'MOYEN', 'ELEVE') NOT NULL DEFAULT 'FAIBLE',
    `vigilanceType` ENUM('SIMPLIFIEE', 'NORMALE', 'RENFORCEE') NOT NULL DEFAULT 'NORMALE',
    `isPep` BOOLEAN NOT NULL DEFAULT false,
    `pepCategory` ENUM('PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP') NULL,
    `pepFunction` VARCHAR(191) NULL,
    `hasRiskyCountryLink` BOOLEAN NOT NULL DEFAULT false,
    `sourceOfFunds` TEXT NULL,
    `sourceOfWealth` TEXT NULL,
    `status` ENUM('EN_COURS', 'VALIDE', 'A_REVOIR', 'REFUSE') NOT NULL DEFAULT 'EN_COURS',
    `validatedById` INTEGER NULL,
    `validatedAt` DATETIME(3) NULL,
    `nextReviewDate` DATETIME(3) NULL,
    `lastScoredAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlProfile_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlProfile_reference_key`(`reference`),
    INDEX `AmlProfile_riskLevel_idx`(`riskLevel`),
    INDEX `AmlProfile_status_idx`(`status`),
    UNIQUE INDEX `AmlProfile_subjectType_subjectId_key`(`subjectType`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlBeneficialOwner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
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

    INDEX `AmlBeneficialOwner_profileId_idx`(`profileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlProfileRiskFactor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `riskFactorId` INTEGER NOT NULL,
    `source` ENUM('AUTO', 'MANUEL') NOT NULL DEFAULT 'MANUEL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AmlProfileRiskFactor_profileId_riskFactorId_key`(`profileId`, `riskFactorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlWatchlistMatch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `watchlistId` INTEGER NOT NULL,
    `status` ENUM('A_VERIFIER', 'CONFIRME', 'FAUX_POSITIF') NOT NULL DEFAULT 'A_VERIFIER',
    `matchScore` INTEGER NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AmlWatchlistMatch_profileId_idx`(`profileId`),
    INDEX `AmlWatchlistMatch_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlTransactionReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `conventionId` INTEGER NOT NULL,
    `conventionReference` VARCHAR(191) NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `triggerReason` ENUM('SEUIL_MONTANT', 'RISQUE_ELEVE', 'PEP', 'PAYS_RISQUE', 'ESPECES', 'WATCHLIST', 'MANUEL') NOT NULL,
    `amount` DECIMAL(15, 2) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `status` ENUM('OUVERTE', 'EN_COURS', 'CLOTUREE_RAS', 'CLOTUREE_DECLAREE') NOT NULL DEFAULT 'OUVERTE',
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `conclusion` TEXT NULL,
    `notes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlTransactionReview_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlTransactionReview_reference_key`(`reference`),
    INDEX `AmlTransactionReview_conventionId_idx`(`conventionId`),
    INDEX `AmlTransactionReview_status_idx`(`status`),
    INDEX `AmlTransactionReview_subjectType_subjectId_idx`(`subjectType`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlSuspiciousReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `conventionId` INTEGER NULL,
    `transactionReviewId` INTEGER NULL,
    `motifCategory` ENUM('STRUCTURATION', 'ORIGINE_FONDS_SUSPECTE', 'INCOHERENCE_PROFIL', 'MONTAGE_COMPLEXE', 'PEP_NON_JUSTIFIE', 'WATCHLIST_CONFIRMEE', 'AUTRE') NULL,
    `motif` TEXT NOT NULL,
    `status` ENUM('BROUILLON', 'VALIDEE_INTERNE', 'TRANSMISE_CENTIF', 'CLASSEE_SANS_SUITE') NOT NULL DEFAULT 'BROUILLON',
    `declaredById` INTEGER NOT NULL,
    `complianceOfficerId` INTEGER NULL,
    `transmittedById` INTEGER NULL,
    `transmittedAt` DATETIME(3) NULL,
    `centifReference` VARCHAR(191) NULL,
    `classificationReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlSuspiciousReport_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlSuspiciousReport_reference_key`(`reference`),
    INDEX `AmlSuspiciousReport_status_idx`(`status`),
    INDEX `AmlSuspiciousReport_subjectType_subjectId_idx`(`subjectType`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `amlProfileId` INTEGER NULL,
    ADD COLUMN `amlSuspiciousReportId` INTEGER NULL,
    ADD COLUMN `amlTransactionReviewId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_amlProfileId_fkey` FOREIGN KEY (`amlProfileId`) REFERENCES `AmlProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_amlTransactionReviewId_fkey` FOREIGN KEY (`amlTransactionReviewId`) REFERENCES `AmlTransactionReview`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_amlSuspiciousReportId_fkey` FOREIGN KEY (`amlSuspiciousReportId`) REFERENCES `AmlSuspiciousReport`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlProfile` ADD CONSTRAINT `AmlProfile_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlProfile` ADD CONSTRAINT `AmlProfile_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlBeneficialOwner` ADD CONSTRAINT `AmlBeneficialOwner_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `AmlProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlProfileRiskFactor` ADD CONSTRAINT `AmlProfileRiskFactor_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `AmlProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlProfileRiskFactor` ADD CONSTRAINT `AmlProfileRiskFactor_riskFactorId_fkey` FOREIGN KEY (`riskFactorId`) REFERENCES `AmlRiskFactorCatalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlWatchlistMatch` ADD CONSTRAINT `AmlWatchlistMatch_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `AmlProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlWatchlistMatch` ADD CONSTRAINT `AmlWatchlistMatch_watchlistId_fkey` FOREIGN KEY (`watchlistId`) REFERENCES `AmlWatchlist`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlWatchlistMatch` ADD CONSTRAINT `AmlWatchlistMatch_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlTransactionReview` ADD CONSTRAINT `AmlTransactionReview_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlTransactionReview` ADD CONSTRAINT `AmlTransactionReview_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlSuspiciousReport` ADD CONSTRAINT `AmlSuspiciousReport_declaredById_fkey` FOREIGN KEY (`declaredById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlSuspiciousReport` ADD CONSTRAINT `AmlSuspiciousReport_complianceOfficerId_fkey` FOREIGN KEY (`complianceOfficerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlSuspiciousReport` ADD CONSTRAINT `AmlSuspiciousReport_transmittedById_fkey` FOREIGN KEY (`transmittedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlSuspiciousReport` ADD CONSTRAINT `AmlSuspiciousReport_transactionReviewId_fkey` FOREIGN KEY (`transactionReviewId`) REFERENCES `AmlTransactionReview`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
