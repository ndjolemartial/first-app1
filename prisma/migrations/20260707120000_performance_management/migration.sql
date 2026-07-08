-- Module 14 — Évaluation & gestion des performances du personnel
-- managerId (responsable hiérarchique) + modèles de performance.

-- AlterTable
ALTER TABLE `Employee` ADD COLUMN `managerId` INTEGER NULL;

-- CreateTable
CREATE TABLE `KpiDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `source` ENUM('SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'ATTENDANCE', 'LEAVE', 'PROJECT', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `metric` ENUM('SALES_COUNT', 'SALES_AMOUNT', 'COMMISSION_AMOUNT', 'ENCAISSEMENT_AMOUNT', 'CRM_ACTIVITIES_DONE', 'CRM_VISITS', 'CRM_CALLS', 'ATTENDANCE_RATE', 'OVERTIME_HOURS', 'ABSENCE_DAYS', 'MANUAL_VALUE') NOT NULL DEFAULT 'MANUAL_VALUE',
    `unit` VARCHAR(191) NULL,
    `direction` ENUM('HIGHER_BETTER', 'LOWER_BETTER') NOT NULL DEFAULT 'HIGHER_BETTER',
    `defaultTarget` DECIMAL(15, 2) NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `KpiDefinition_uuid_key`(`uuid`),
    UNIQUE INDEX `KpiDefinition_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceWeightProfile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `poste` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PerformanceWeightProfile_uuid_key`(`uuid`),
    INDEX `PerformanceWeightProfile_poste_idx`(`poste`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceWeightLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` INTEGER NOT NULL,
    `kpiDefinitionId` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,

    INDEX `PerformanceWeightLine_profileId_idx`(`profileId`),
    INDEX `PerformanceWeightLine_kpiDefinitionId_idx`(`kpiDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceObjective` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `cycleType` ENUM('ANNUEL', 'TRIMESTRIEL') NOT NULL DEFAULT 'ANNUEL',
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `weight` DECIMAL(6, 2) NOT NULL DEFAULT 1,
    `targetValue` DECIMAL(15, 2) NULL,
    `unit` VARCHAR(191) NULL,
    `kpiDefinitionId` INTEGER NULL,
    `measureType` ENUM('AUTO', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('EN_COURS', 'ATTEINT', 'PARTIEL', 'NON_ATTEINT', 'ANNULE') NOT NULL DEFAULT 'EN_COURS',
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PerformanceObjective_uuid_key`(`uuid`),
    INDEX `PerformanceObjective_employeeId_idx`(`employeeId`),
    INDEX `PerformanceObjective_kpiDefinitionId_idx`(`kpiDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceEvaluation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `cycleType` ENUM('ANNUEL', 'TRIMESTRIEL') NOT NULL DEFAULT 'ANNUEL',
    `year` INTEGER NOT NULL,
    `quarter` INTEGER NULL,
    `evaluatorId` INTEGER NULL,
    `globalScore` DECIMAL(6, 2) NULL,
    `status` ENUM('BROUILLON', 'SOUMISE', 'VALIDEE_RESPONSABLE', 'VALIDEE_COLLABORATEUR', 'VALIDEE_DIRECTION', 'CLOTUREE', 'REFUSEE') NOT NULL DEFAULT 'BROUILLON',
    `managerSignedById` INTEGER NULL,
    `managerSignedAt` DATETIME(3) NULL,
    `employeeSignedById` INTEGER NULL,
    `employeeSignedAt` DATETIME(3) NULL,
    `directionSignedById` INTEGER NULL,
    `directionSignedAt` DATETIME(3) NULL,
    `refusedById` INTEGER NULL,
    `refusedAt` DATETIME(3) NULL,
    `refusalReason` TEXT NULL,
    `strengths` TEXT NULL,
    `areasToImprove` TEXT NULL,
    `comments` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PerformanceEvaluation_uuid_key`(`uuid`),
    UNIQUE INDEX `PerformanceEvaluation_reference_key`(`reference`),
    INDEX `PerformanceEvaluation_employeeId_idx`(`employeeId`),
    INDEX `PerformanceEvaluation_evaluatorId_idx`(`evaluatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceEvaluationLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evaluationId` INTEGER NOT NULL,
    `objectiveId` INTEGER NULL,
    `kpiDefinitionId` INTEGER NULL,
    `label` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL DEFAULT 1,
    `targetValue` DECIMAL(15, 2) NULL,
    `actualValue` DECIMAL(15, 2) NULL,
    `score` DECIMAL(6, 2) NULL,
    `comment` TEXT NULL,

    INDEX `PerformanceEvaluationLine_evaluationId_idx`(`evaluationId`),
    INDEX `PerformanceEvaluationLine_kpiDefinitionId_idx`(`kpiDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressPlan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `evaluationId` INTEGER NULL,
    `employeeId` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `actions` TEXT NULL,
    `trainingNeeds` TEXT NULL,
    `dueDate` DATETIME(3) NULL,
    `status` ENUM('EN_COURS', 'REALISE', 'ABANDONNE') NOT NULL DEFAULT 'EN_COURS',
    `followUpNotes` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProgressPlan_uuid_key`(`uuid`),
    INDEX `ProgressPlan_employeeId_idx`(`employeeId`),
    INDEX `ProgressPlan_evaluationId_idx`(`evaluationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceRankingSnapshot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `periodType` ENUM('SEMAINE', 'MOIS', 'TRIMESTRE', 'SEMESTRE', 'ANNEE') NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `basis` ENUM('KPI', 'EVALUATION') NOT NULL DEFAULT 'KPI',
    `generatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PerformanceRankingSnapshot_uuid_key`(`uuid`),
    INDEX `PerformanceRankingSnapshot_periodType_periodStart_idx`(`periodType`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PerformanceRankingEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `snapshotId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `score` DECIMAL(8, 2) NOT NULL,
    `rank` INTEGER NOT NULL,

    INDEX `PerformanceRankingEntry_snapshotId_idx`(`snapshotId`),
    INDEX `PerformanceRankingEntry_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Employee_managerId_idx` ON `Employee`(`managerId`);

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceWeightLine` ADD CONSTRAINT `PerformanceWeightLine_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `PerformanceWeightProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceWeightLine` ADD CONSTRAINT `PerformanceWeightLine_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceObjective` ADD CONSTRAINT `PerformanceObjective_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceObjective` ADD CONSTRAINT `PerformanceObjective_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceEvaluation` ADD CONSTRAINT `PerformanceEvaluation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceEvaluation` ADD CONSTRAINT `PerformanceEvaluation_evaluatorId_fkey` FOREIGN KEY (`evaluatorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceEvaluationLine` ADD CONSTRAINT `PerformanceEvaluationLine_evaluationId_fkey` FOREIGN KEY (`evaluationId`) REFERENCES `PerformanceEvaluation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceEvaluationLine` ADD CONSTRAINT `PerformanceEvaluationLine_kpiDefinitionId_fkey` FOREIGN KEY (`kpiDefinitionId`) REFERENCES `KpiDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressPlan` ADD CONSTRAINT `ProgressPlan_evaluationId_fkey` FOREIGN KEY (`evaluationId`) REFERENCES `PerformanceEvaluation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProgressPlan` ADD CONSTRAINT `ProgressPlan_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceRankingSnapshot` ADD CONSTRAINT `PerformanceRankingSnapshot_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceRankingEntry` ADD CONSTRAINT `PerformanceRankingEntry_snapshotId_fkey` FOREIGN KEY (`snapshotId`) REFERENCES `PerformanceRankingSnapshot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PerformanceRankingEntry` ADD CONSTRAINT `PerformanceRankingEntry_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
