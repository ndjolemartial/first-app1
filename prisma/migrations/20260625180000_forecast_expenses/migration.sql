-- Module Charges / dépenses prévisionnelles.

-- Table des charges prévisionnelles.
CREATE TABLE `ForecastExpense` (
  `id`            INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`          VARCHAR(191) NOT NULL,
  `reference`     VARCHAR(191) NOT NULL,
  `label`         VARCHAR(191) NOT NULL,
  `categoryId`    INTEGER NOT NULL,
  `amount`        DECIMAL(15, 2) NOT NULL,
  `dueDate`       DATETIME(3) NOT NULL,
  `status`        ENUM('PREVUE', 'REGLEE', 'ANNULEE') NOT NULL DEFAULT 'PREVUE',
  `notes`         TEXT NULL,
  `settledAt`     DATETIME(3) NULL,
  `settledAmount` DECIMAL(15, 2) NULL,
  `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'NON_DEFINI') NULL,
  `createdById`   INTEGER NULL,
  `settledById`   INTEGER NULL,
  `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3) NOT NULL,
  `deletedAt`     DATETIME(3) NULL,

  UNIQUE INDEX `ForecastExpense_uuid_key`(`uuid`),
  UNIQUE INDEX `ForecastExpense_reference_key`(`reference`),
  INDEX `ForecastExpense_categoryId_idx`(`categoryId`),
  INDEX `ForecastExpense_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ForecastExpense` ADD CONSTRAINT `ForecastExpense_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `TreasuryCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ForecastExpense` ADD CONSTRAINT `ForecastExpense_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ForecastExpense` ADD CONSTRAINT `ForecastExpense_settledById_fkey`
  FOREIGN KEY (`settledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Nouvelle origine d'opération : règlement d'une charge prévisionnelle.
ALTER TABLE `TreasuryOperation`
  MODIFY COLUMN `source` ENUM('MANUEL', 'FACTURE', 'ECHEANCE', 'COMMISSION', 'PAIE', 'CHARGE') NOT NULL DEFAULT 'MANUEL';

ALTER TABLE `TreasuryOperation` ADD COLUMN `forecastExpenseId` INTEGER NULL;
CREATE INDEX `TreasuryOperation_forecastExpenseId_idx` ON `TreasuryOperation`(`forecastExpenseId`);
ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_forecastExpenseId_fkey`
  FOREIGN KEY (`forecastExpenseId`) REFERENCES `ForecastExpense`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Lien du rappel CRM vers la charge prévisionnelle.
ALTER TABLE `CrmActivity` ADD COLUMN `forecastExpenseId` INTEGER NULL;
CREATE INDEX `CrmActivity_forecastExpenseId_idx` ON `CrmActivity`(`forecastExpenseId`);
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_forecastExpenseId_fkey`
  FOREIGN KEY (`forecastExpenseId`) REFERENCES `ForecastExpense`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
