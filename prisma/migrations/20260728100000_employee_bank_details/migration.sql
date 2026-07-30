-- Détail des coordonnées bancaires de l'employé (Code Banque, Code Guichet,
-- Numéro de compte, Clé RIB), en complément du champ RIB/IBAN existant.

-- AlterTable
ALTER TABLE `Employee`
  ADD COLUMN `bankCode` VARCHAR(191) NULL,
  ADD COLUMN `bankGuichetCode` VARCHAR(191) NULL,
  ADD COLUMN `bankAccountNumber` VARCHAR(191) NULL,
  ADD COLUMN `bankRibKey` VARCHAR(191) NULL;
