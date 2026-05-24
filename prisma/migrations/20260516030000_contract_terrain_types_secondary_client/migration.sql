-- AlterTable : nouveaux types de contrat (terrain) + souscripteur associé / successeur
ALTER TABLE `Contract` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION') NOT NULL;

-- AlterTable
ALTER TABLE `Contract` ADD COLUMN `secondaryClientId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_secondaryClientId_fkey` FOREIGN KEY (`secondaryClientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
