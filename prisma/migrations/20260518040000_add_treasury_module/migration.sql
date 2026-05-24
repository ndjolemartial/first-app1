-- CreateTable : comptes de trésorerie (banque, caisse, mobile money)
CREATE TABLE `BankAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('BANQUE', 'CAISSE', 'MOBILE_MONEY') NOT NULL DEFAULT 'BANQUE',
    `bankName` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `iban` VARCHAR(191) NULL,
    `bic` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'XOF',
    `initialBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `BankAccount_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable : objets d'opération avec numéro de compte comptable
CREATE TABLE `TreasuryCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `direction` ENUM('ENTREE', 'SORTIE') NOT NULL,
    `accountingCode` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `TreasuryCategory_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable : mouvements de trésorerie (entrées / sorties)
CREATE TABLE `TreasuryOperation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `bankAccountId` INTEGER NOT NULL,
    `direction` ENUM('ENTREE', 'SORTIE') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `operationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `categoryId` INTEGER NULL,
    `label` VARCHAR(191) NOT NULL,
    `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'NON_DEFINI') NOT NULL DEFAULT 'ESPECE',
    `paymentRef` VARCHAR(191) NULL,
    `source` ENUM('MANUEL', 'FACTURE', 'ECHEANCE', 'COMMISSION') NOT NULL DEFAULT 'MANUEL',
    `paymentId` INTEGER NULL,
    `installmentId` INTEGER NULL,
    `commissionId` INTEGER NULL,
    `createdById` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `TreasuryOperation_uuid_key`(`uuid`),
    UNIQUE INDEX `TreasuryOperation_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable : compte de trésorerie crédité par un règlement de facture
ALTER TABLE `Payment` ADD COLUMN `bankAccountId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `BankAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `TreasuryCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bankAccountId_fkey` FOREIGN KEY (`bankAccountId`) REFERENCES `BankAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
