-- AlterTable
ALTER TABLE `Terrain` ADD COLUMN `clientId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Terrain` ADD CONSTRAINT `Terrain_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
