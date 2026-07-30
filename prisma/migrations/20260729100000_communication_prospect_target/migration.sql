-- Ciblage « Prospect » sur l'interface « Envoyer un message » (mêmes règles
-- que le ciblage « Client ») : rattachement optionnel Communication -> Prospect.

-- AlterTable
ALTER TABLE `Communication` ADD COLUMN `prospectId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Communication_prospectId_idx` ON `Communication`(`prospectId`);

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
