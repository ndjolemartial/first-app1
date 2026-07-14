-- Référence (ou lot) optionnelle par ligne de devis.

-- AlterTable
ALTER TABLE `QuoteItem` ADD COLUMN `reference` VARCHAR(191) NULL;
