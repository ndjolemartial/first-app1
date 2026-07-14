-- Titre modifiable de la colonne « Référence / LOT » du tableau des articles d'un devis.

-- AlterTable
ALTER TABLE `Quote` ADD COLUMN `referenceColumnLabel` VARCHAR(191) NULL;
