-- AlterTable: ajout de la profession (client particulier) et des informations
-- complémentaires d'entreprise (site web, activités) sur le client.
ALTER TABLE `Client` ADD COLUMN `profession` VARCHAR(191) NULL;
ALTER TABLE `Client` ADD COLUMN `website` VARCHAR(191) NULL;
ALTER TABLE `Client` ADD COLUMN `companyActivity` VARCHAR(191) NULL;
