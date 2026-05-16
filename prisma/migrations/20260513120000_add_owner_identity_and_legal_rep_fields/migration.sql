-- AlterTable: add identity and legal representative fields to Owner
ALTER TABLE `Owner`
  ADD COLUMN `idNumber` VARCHAR(191) NULL,
  ADD COLUMN `registreCommerce` VARCHAR(191) NULL,
  ADD COLUMN `legalRepFirstName` VARCHAR(191) NULL,
  ADD COLUMN `legalRepLastName` VARCHAR(191) NULL,
  ADD COLUMN `legalRepPhone` VARCHAR(191) NULL,
  ADD COLUMN `legalRepIdNumber` VARCHAR(191) NULL;
