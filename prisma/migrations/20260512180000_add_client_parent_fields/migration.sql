-- AlterTable
ALTER TABLE `Client`
  ADD COLUMN `fatherFirstName` VARCHAR(191) NULL,
  ADD COLUMN `fatherLastName`  VARCHAR(191) NULL,
  ADD COLUMN `motherFirstName` VARCHAR(191) NULL,
  ADD COLUMN `motherLastName`  VARCHAR(191) NULL;
