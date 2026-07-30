-- Module 16 — Innovations IT : fiche d'innovation portée par un employé,
-- validée en 3 phases (énoncé/description 15% → démonstration/test +35%,
-- cumulé 50% → validation finale/intégration +50%, cumulé 100%).
-- Alimente le KPI IT_INNOVATIONS_IMPLEMENTED (source IT_INNOVATION).

-- AlterTable (KPI enums)
ALTER TABLE `KpiDefinition` MODIFY `source` ENUM('SALES', 'COMMISSIONS', 'ACCOUNTING', 'CRM', 'PROSPECTS', 'ATTENDANCE', 'LEAVE', 'PROJECT', 'SOCIAL', 'IT_INNOVATION', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    MODIFY `metric` ENUM('SALES_COUNT', 'SALES_AMOUNT', 'RESILIATION_COUNT', 'COMMISSION_AMOUNT', 'ENCAISSEMENT_AMOUNT', 'CRM_ACTIVITIES_DONE', 'CRM_VISITS', 'CRM_CALLS', 'PROSPECT_CONVERSION_RATE', 'NEW_POTENTIAL_PROSPECTS', 'SOCIAL_PUBLICATIONS_COUNT', 'SOCIAL_VIEWS', 'SOCIAL_INTERACTIONS', 'SOCIAL_FOLLOWERS_GROWTH', 'ATTENDANCE_RATE', 'OVERTIME_HOURS', 'ABSENCE_DAYS', 'LATE_EARLY_DEPARTURE_HOURS', 'IT_INNOVATIONS_IMPLEMENTED', 'MANUAL_VALUE') NOT NULL DEFAULT 'MANUAL_VALUE';

-- CreateTable
CREATE TABLE `ItInnovation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NOT NULL,
    `createdById` INTEGER NULL,
    `status` ENUM('PHASE1_EN_ATTENTE', 'PHASE1_REJETEE', 'PHASE2_EN_COURS', 'PHASE2_EN_ATTENTE', 'PHASE2_REJETEE', 'PHASE3_EN_COURS', 'PHASE3_EN_ATTENTE', 'PHASE3_REJETEE', 'VALIDEE') NOT NULL DEFAULT 'PHASE1_EN_ATTENTE',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `phase1Description` TEXT NOT NULL,
    `phase1ValidatedById` INTEGER NULL,
    `phase1ValidatedAt` DATETIME(3) NULL,
    `phase1RejectedAt` DATETIME(3) NULL,
    `phase1RejectionReason` TEXT NULL,
    `phase2Description` TEXT NULL,
    `phase2SubmittedAt` DATETIME(3) NULL,
    `phase2ValidatedById` INTEGER NULL,
    `phase2ValidatedAt` DATETIME(3) NULL,
    `phase2RejectedAt` DATETIME(3) NULL,
    `phase2RejectionReason` TEXT NULL,
    `phase3Description` TEXT NULL,
    `phase3SubmittedAt` DATETIME(3) NULL,
    `phase3ValidatedById` INTEGER NULL,
    `phase3ValidatedAt` DATETIME(3) NULL,
    `phase3RejectedAt` DATETIME(3) NULL,
    `phase3RejectionReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ItInnovation_uuid_key`(`uuid`),
    UNIQUE INDEX `ItInnovation_reference_key`(`reference`),
    INDEX `ItInnovation_employeeId_idx`(`employeeId`),
    INDEX `ItInnovation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ItInnovation` ADD CONSTRAINT `ItInnovation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
