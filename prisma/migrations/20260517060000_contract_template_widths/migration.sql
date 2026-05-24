-- AlterTable : largeur réglable de l'en-tête et du pied de page (pourcentage)
ALTER TABLE `ContractTemplate` ADD COLUMN `headerWidth` INTEGER NOT NULL DEFAULT 100;
ALTER TABLE `ContractTemplate` ADD COLUMN `footerWidth` INTEGER NOT NULL DEFAULT 100;
