-- Poste sélectionnable (JobPosition) + objectifs de performance par poste.

-- DropForeignKey (pour rendre PerformanceObjective.employeeId nullable)
ALTER TABLE `PerformanceObjective` DROP FOREIGN KEY `PerformanceObjective_employeeId_fkey`;

-- AlterTable : cible par employé OU par poste
ALTER TABLE `PerformanceObjective` ADD COLUMN `poste` VARCHAR(191) NULL,
    MODIFY `employeeId` INTEGER NULL;

-- CreateTable
CREATE TABLE `JobPosition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `JobPosition_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PerformanceObjective_poste_idx` ON `PerformanceObjective`(`poste`);

-- AddForeignKey (ON DELETE SET NULL car employeeId est désormais nullable)
ALTER TABLE `PerformanceObjective` ADD CONSTRAINT `PerformanceObjective_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
