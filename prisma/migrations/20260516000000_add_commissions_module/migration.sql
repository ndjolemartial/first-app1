-- CreateTable
CREATE TABLE `BusinessReferrer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `mobile` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'CI',
    `bankIban` VARCHAR(191) NULL,
    `bankBic` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `BusinessReferrer_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Commission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `contractId` INTEGER NOT NULL,
    `beneficiaryType` ENUM('USER', 'REFERRER') NOT NULL,
    `userId` INTEGER NULL,
    `referrerId` INTEGER NULL,
    `transactionType` ENUM('VENTE', 'LOCATION') NOT NULL,
    `baseAmount` DECIMAL(15, 2) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('A_PAYER', 'PAYEE', 'ANNULEE') NOT NULL DEFAULT 'A_PAYER',
    `source` ENUM('MANUEL', 'AUTOMATIQUE') NOT NULL DEFAULT 'MANUEL',
    `paidAt` DATETIME(3) NULL,
    `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY') NULL,
    `paymentRef` VARCHAR(191) NULL,
    `paidById` INTEGER NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `cancelledById` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Commission_uuid_key`(`uuid`),
    UNIQUE INDEX `Commission_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `BusinessReferrer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_cancelledById_fkey` FOREIGN KEY (`cancelledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
