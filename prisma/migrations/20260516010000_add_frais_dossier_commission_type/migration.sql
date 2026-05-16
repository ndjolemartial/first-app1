-- AlterTable
ALTER TABLE `Commission` MODIFY `transactionType` ENUM('VENTE', 'LOCATION', 'FRAIS_DOSSIER') NOT NULL;
