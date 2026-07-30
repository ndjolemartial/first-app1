-- Nom du signataire (sous la fonction, ex. « Le Directeur Général ») du bloc
-- de signature de l'ordre de virement.

-- AlterTable
ALTER TABLE `WireTransferTemplate` ADD COLUMN `signatureName` VARCHAR(191) NULL;
