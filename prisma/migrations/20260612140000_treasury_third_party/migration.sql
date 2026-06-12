-- CreateTable: tiers de trésorerie (bénéficiaire d'une sortie / émetteur d'une entrée).
CREATE TABLE `TreasuryThirdParty` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `contacts` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `TreasuryThirdParty_uuid_key`(`uuid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddColumn: rattachement d'une opération de trésorerie à un tiers.
ALTER TABLE `TreasuryOperation` ADD COLUMN `thirdPartyId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `TreasuryOperation`
  ADD CONSTRAINT `TreasuryOperation_thirdPartyId_fkey`
  FOREIGN KEY (`thirdPartyId`) REFERENCES `TreasuryThirdParty`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
