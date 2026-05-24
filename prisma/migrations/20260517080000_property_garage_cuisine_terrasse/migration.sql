-- AlterTable : équipements descriptifs du bien (champs texte libres)
ALTER TABLE `Property` ADD COLUMN `garage` VARCHAR(191) NULL;
ALTER TABLE `Property` ADD COLUMN `cuisine` VARCHAR(191) NULL;
ALTER TABLE `Property` ADD COLUMN `terrasseBalcon` VARCHAR(191) NULL;
