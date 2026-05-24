-- AlterTable : nature de l'avenant (prolongation de délai, transfert de propriété, transfert de site)
ALTER TABLE `Contract` ADD COLUMN `amendmentType` ENUM('PROLONGATION_DELAI', 'TRANSFERT_PROPRIETE', 'TRANSFERT_SITE') NULL;
