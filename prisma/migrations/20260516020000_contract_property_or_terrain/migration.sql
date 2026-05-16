-- DropForeignKey
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_propertyId_fkey`;

-- AlterTable
ALTER TABLE `Contract` ADD COLUMN `assetType` ENUM('PROPERTY', 'TERRAIN') NOT NULL DEFAULT 'PROPERTY',
    ADD COLUMN `terrainId` INTEGER NULL,
    MODIFY `propertyId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_terrainId_fkey` FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
