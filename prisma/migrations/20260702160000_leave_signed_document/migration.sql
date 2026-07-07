-- Fiche « Congés & Absence » signée (scannée) jointe à une demande après validation.
ALTER TABLE `LeaveRequest`
  ADD COLUMN `signedDocPath` VARCHAR(191) NULL,
  ADD COLUMN `signedDocName` VARCHAR(191) NULL,
  ADD COLUMN `signedDocType` VARCHAR(191) NULL,
  ADD COLUMN `signedDocSize` INTEGER NULL,
  ADD COLUMN `signedDocAt` DATETIME(3) NULL;
