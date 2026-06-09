-- AlterEnum InvoiceType : ajout du type FRAIS_OUVERTURE_DOSSIER (factures
-- automatiques des frais d'ouverture de dossier à l'ouverture d'une convention).
ALTER TABLE `Invoice` MODIFY COLUMN `type`
  ENUM('VENTE','ECHEANCE_VENTE','FRAIS_AGENCE','FRAIS_DE_GESTION','FRAIS_DEMARCHES_ACD','FRAIS_OUVERTURE_DOSSIER','AVANCE','CAUTION','OTHER') NOT NULL;
