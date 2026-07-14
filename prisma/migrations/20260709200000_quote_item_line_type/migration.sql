-- Type de ligne d'un devis (article normal, titre, sous-titre).

-- AlterTable
ALTER TABLE `QuoteItem` ADD COLUMN `lineType` ENUM('ARTICLE', 'TITLE', 'SUBTITLE') NOT NULL DEFAULT 'ARTICLE';
