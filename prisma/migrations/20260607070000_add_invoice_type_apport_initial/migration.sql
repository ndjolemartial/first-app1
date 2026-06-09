-- AlterEnum InvoiceType : ajout du type APPORT_INITIAL (facture automatique de
-- l'apport initial à l'ouverture d'une convention, distinct de AVANCE).
ALTER TABLE `Invoice` MODIFY COLUMN `type`
  ENUM('VENTE','ECHEANCE_VENTE','FRAIS_AGENCE','FRAIS_DE_GESTION','FRAIS_DEMARCHES_ACD','FRAIS_OUVERTURE_DOSSIER','APPORT_INITIAL','AVANCE','CAUTION','OTHER') NOT NULL;
