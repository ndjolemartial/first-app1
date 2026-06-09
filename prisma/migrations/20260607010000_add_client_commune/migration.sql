-- AlterTable: ajout de la commune du client (saisie en face de l'adresse).
ALTER TABLE `Client` ADD COLUMN `commune` VARCHAR(191) NULL;
