-- AlterTable : hauteur réglable de l'en-tête et du pied de page (pixels)
ALTER TABLE `ContractTemplate` ADD COLUMN `headerHeight` INTEGER NOT NULL DEFAULT 140;
ALTER TABLE `ContractTemplate` ADD COLUMN `footerHeight` INTEGER NOT NULL DEFAULT 140;
