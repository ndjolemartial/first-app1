-- Article du catalogue d'origine (scalaire, sans FK) — permet d'empêcher
-- l'ajout en double du même article dans un devis.

-- AlterTable
ALTER TABLE `QuoteItem` ADD COLUMN `catalogItemId` INTEGER NULL;
