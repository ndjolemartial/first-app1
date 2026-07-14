-- Ajoute le champ « Référence » (libre, optionnel) sur les articles du catalogue.

-- AlterTable
ALTER TABLE `CatalogItem` ADD COLUMN `reference` VARCHAR(191) NULL;
