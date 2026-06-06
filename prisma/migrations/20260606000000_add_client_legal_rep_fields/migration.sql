-- AlterTable: ajout des champs du représentant légal (client entreprise)
ALTER TABLE `Client`
  ADD COLUMN `legalRepFirstName` VARCHAR(191) NULL,
  ADD COLUMN `legalRepLastName`  VARCHAR(191) NULL,
  ADD COLUMN `legalRepPhone`     VARCHAR(191) NULL,
  ADD COLUMN `legalRepIdNumber`  VARCHAR(191) NULL,
  ADD COLUMN `legalRepIdTypeId`  INTEGER NULL;

CREATE INDEX `Client_legalRepIdTypeId_idx` ON `Client`(`legalRepIdTypeId`);

ALTER TABLE `Client` ADD CONSTRAINT `Client_legalRepIdTypeId_fkey`
  FOREIGN KEY (`legalRepIdTypeId`) REFERENCES `IdDocumentType`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
