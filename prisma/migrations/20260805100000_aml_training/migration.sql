-- Module 19 (suite) — Suivi des formations LBC/FT/FP du personnel
-- Nouveau modèle AmlTraining + rattachement optionnel sur Document. Généré
-- via `prisma migrate diff --from-url ... --to-schema-datamodel
-- prisma/schema.prisma --script` puis restreint aux seules instructions
-- liées à cet ajout (le diff brut incluait aussi la même dérive de schéma
-- préexistante et sans rapport que la migration `20260804100000_aml_module`
-- — Commission/SaleInstallment/ProjectPhoto/DocumentFolderAccess FKs,
-- Project/ProjectType/ReminderRule — volontairement exclue ici aussi).

-- CreateTable
CREATE TABLE `AmlTraining` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `trainingDate` DATETIME(3) NOT NULL,
    `topic` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `durationHours` DECIMAL(5, 2) NULL,
    `notes` TEXT NULL,
    `recordedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlTraining_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlTraining_reference_key`(`reference`),
    INDEX `AmlTraining_userId_idx`(`userId`),
    INDEX `AmlTraining_trainingDate_idx`(`trainingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `amlTrainingId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_amlTrainingId_fkey` FOREIGN KEY (`amlTrainingId`) REFERENCES `AmlTraining`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlTraining` ADD CONSTRAINT `AmlTraining_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlTraining` ADD CONSTRAINT `AmlTraining_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
