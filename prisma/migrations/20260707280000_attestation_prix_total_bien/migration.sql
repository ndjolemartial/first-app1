-- Prix total du bien affiché sur l'attestation de solde (échéance héritée).

-- AlterTable
ALTER TABLE `Attestation` ADD COLUMN `prixTotalBien` DECIMAL(15, 2) NULL;
