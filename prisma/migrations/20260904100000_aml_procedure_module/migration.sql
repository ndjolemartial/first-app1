-- Module 19 (suite) — « Nos Procédures LBC/FT » : nouveau modèle AmlProcedure
-- (bibliothèque documentaire des procédures internes, consultable par tout
-- utilisateur, contrairement au reste du module) + rattachement optionnel
-- amlProcedureId sur Document. Rédigé à la main (prisma migrate dev
-- non-interactif) et restreint aux seules instructions liées à cet ajout.

-- CreateTable
CREATE TABLE `AmlProcedure` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlProcedure_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlProcedure_reference_key`(`reference`),
    INDEX `AmlProcedure_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `amlProcedureId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_amlProcedureId_fkey` FOREIGN KEY (`amlProcedureId`) REFERENCES `AmlProcedure`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlProcedure` ADD CONSTRAINT `AmlProcedure_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
