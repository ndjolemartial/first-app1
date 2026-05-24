-- AlterTable : ajout de l'utilisateur référent (suivi commercial) et de l'apporteur d'affaire sur Client
ALTER TABLE `Client` ADD COLUMN `assignedToId` INTEGER NULL;
ALTER TABLE `Client` ADD COLUMN `referrerId` INTEGER NULL;

-- AddForeignKey : utilisateur affecté au client → User
ALTER TABLE `Client` ADD CONSTRAINT `Client_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey : apporteur d'affaire du client → BusinessReferrer
ALTER TABLE `Client` ADD CONSTRAINT `Client_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `BusinessReferrer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
