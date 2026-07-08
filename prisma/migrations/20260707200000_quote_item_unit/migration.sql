-- Unité de mesure optionnelle par ligne de devis.

-- AlterTable
ALTER TABLE `QuoteItem` ADD COLUMN `unit` VARCHAR(191) NULL;
