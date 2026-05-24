-- AlterTable : lien vers le contrat initial/précédent (avenants & résiliations)
ALTER TABLE `Contract` ADD COLUMN `parentContractId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_parentContractId_fkey` FOREIGN KEY (`parentContractId`) REFERENCES `Contract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
