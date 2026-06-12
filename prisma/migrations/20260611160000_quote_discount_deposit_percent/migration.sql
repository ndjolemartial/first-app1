-- AlterTable : remise et acompte du devis définissables en pourcentage.
-- Quand le mode pourcentage est actif, le montant absolu (discountAmount /
-- depositExpected) est recalculé côté serveur à partir du pourcentage.
ALTER TABLE `Quote` ADD COLUMN `discountIsPercent` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Quote` ADD COLUMN `discountPercent` DECIMAL(5, 2) NULL;
ALTER TABLE `Quote` ADD COLUMN `depositIsPercent` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Quote` ADD COLUMN `depositPercent` DECIMAL(5, 2) NULL;
