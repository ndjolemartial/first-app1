-- Module 19 (suite) — « Registres LBC/FT » : 4 nouveaux modèles (registre de
-- suivi des notifications, registre de suivi des échanges CENTIF-CI, grille
-- de recensement DSTE, registre des opérations suspectes). Rédigé à la main
-- (prisma migrate dev non-interactif) et restreint aux seules instructions
-- liées à cet ajout.

-- CreateTable
CREATE TABLE `AmlNotificationRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `updateDate` DATETIME(3) NOT NULL,
    `updateDescription` TEXT NOT NULL,
    `notificationDate` DATETIME(3) NULL,
    `transmissionMode` VARCHAR(191) NULL,
    `ackReceived` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `recordedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlNotificationRecord_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlNotificationRecord_reference_key`(`reference`),
    INDEX `AmlNotificationRecord_updateDate_idx`(`updateDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlCentifExchange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `exchangeDate` DATETIME(3) NOT NULL,
    `direction` ENUM('ENTRANT', 'SORTANT') NOT NULL,
    `nature` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NULL,
    `status` ENUM('EN_COURS', 'CLOTURE', 'SANS_SUITE') NOT NULL DEFAULT 'EN_COURS',
    `closedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `recordedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlCentifExchange_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlCentifExchange_reference_key`(`reference`),
    INDEX `AmlCentifExchange_exchangeDate_idx`(`exchangeDate`),
    INDEX `AmlCentifExchange_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlDsteRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `transactionDate` DATETIME(3) NOT NULL,
    `subjectLabel` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `description` TEXT NULL,
    `notes` TEXT NULL,
    `recordedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlDsteRecord_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlDsteRecord_reference_key`(`reference`),
    INDEX `AmlDsteRecord_transactionDate_idx`(`transactionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AmlSuspiciousOperationRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `detectionDate` DATETIME(3) NOT NULL,
    `subjectLabel` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `decision` ENUM('DOS_TRANSMISE', 'DOS_NON_RETENUE') NULL,
    `dosExchangeId` INTEGER NULL,
    `notes` TEXT NULL,
    `recordedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AmlSuspiciousOperationRecord_uuid_key`(`uuid`),
    UNIQUE INDEX `AmlSuspiciousOperationRecord_reference_key`(`reference`),
    INDEX `AmlSuspiciousOperationRecord_detectionDate_idx`(`detectionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AmlNotificationRecord` ADD CONSTRAINT `AmlNotificationRecord_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlCentifExchange` ADD CONSTRAINT `AmlCentifExchange_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlDsteRecord` ADD CONSTRAINT `AmlDsteRecord_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlSuspiciousOperationRecord` ADD CONSTRAINT `AmlSuspiciousOperationRecord_dosExchangeId_fkey` FOREIGN KEY (`dosExchangeId`) REFERENCES `AmlCentifExchange`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AmlSuspiciousOperationRecord` ADD CONSTRAINT `AmlSuspiciousOperationRecord_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
