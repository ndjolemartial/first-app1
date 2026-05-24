-- AlterEnum : ajout du type de transaction SOUSCRIPTION aux commissions
ALTER TABLE `Commission` MODIFY `transactionType` ENUM('VENTE', 'LOCATION', 'SOUSCRIPTION', 'FRAIS_DOSSIER') NOT NULL;
