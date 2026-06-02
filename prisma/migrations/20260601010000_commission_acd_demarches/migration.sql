-- AlterEnum : ajout du type de transaction FRAIS_DEMARCHES_ACD aux commissions.
-- Permet de générer une commission assise sur les frais de démarches ACD
-- définis au niveau du lotissement rattaché à la convention.
ALTER TABLE `Commission` MODIFY `transactionType` ENUM(
  'VENTE',
  'LOCATION',
  'SOUSCRIPTION',
  'FRAIS_DOSSIER',
  'FRAIS_DEMARCHES_ACD'
) NOT NULL;
