-- CreateTable : budget (enveloppe globale)
CREATE TABLE `Budget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `totalAllocated` DECIMAL(15, 2) NULL,
    `status` ENUM('OUVERT', 'CLOTURE') NOT NULL DEFAULT 'OUVERT',
    `closingSnapshot` JSON NULL,
    `closedAt` DATETIME(3) NULL,
    `closedById` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Budget_uuid_key`(`uuid`),
    UNIQUE INDEX `Budget_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable : ligne budgétaire (poste de dépense rattaché à un budget)
CREATE TABLE `BudgetLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `budgetId` INTEGER NOT NULL,
    `code` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `allocatedAmount` DECIMAL(15, 2) NOT NULL,
    `managerId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `BudgetLine_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable : ligne budgétaire d'imputation sur une opération de trésorerie
ALTER TABLE `TreasuryOperation` ADD COLUMN `budgetLineId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetLine` ADD CONSTRAINT `BudgetLine_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `Budget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetLine` ADD CONSTRAINT `BudgetLine_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_budgetLineId_fkey` FOREIGN KEY (`budgetLineId`) REFERENCES `BudgetLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
