-- AlterTable : ajout du créateur du prospect (auteur de l'enregistrement)
ALTER TABLE `Prospect` ADD COLUMN `createdById` INTEGER NULL;

-- AddForeignKey : créateur du prospect → User
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey : utilisateur affecté au prospect → User (le champ assignedToId existait déjà sans contrainte)
ALTER TABLE `Prospect` ADD CONSTRAINT `Prospect_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
