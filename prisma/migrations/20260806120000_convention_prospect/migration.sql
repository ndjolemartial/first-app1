-- DropForeignKey
ALTER TABLE `Convention` DROP FOREIGN KEY `Convention_clientId_fkey`;

-- AlterTable
ALTER TABLE `Convention` ADD COLUMN `prospectId` INTEGER NULL,
    MODIFY `clientId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Convention_prospectId_idx` ON `Convention`(`prospectId`);

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_prospectId_fkey` FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
