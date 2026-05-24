-- AlterTable : apport initial pour les ventes par échéances
ALTER TABLE `Contract` ADD COLUMN `apportInitial` DECIMAL(15, 2) NULL;
