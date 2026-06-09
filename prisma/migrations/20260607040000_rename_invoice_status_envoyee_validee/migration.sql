-- Renomme la valeur d'enum InvoiceStatus : ENVOYEE -> VALIDEE.
-- 1) Élargit l'enum pour contenir temporairement les deux valeurs.
ALTER TABLE `Invoice` MODIFY COLUMN `status`
  ENUM('BROUILLON','ENVOYEE','VALIDEE','PAYEE','PARTIEL','EN_RETARD','ANNULEE') NOT NULL DEFAULT 'BROUILLON';

-- 2) Migre les données existantes.
UPDATE `Invoice` SET `status` = 'VALIDEE' WHERE `status` = 'ENVOYEE';

-- 3) Resserre l'enum sur la liste finale (sans ENVOYEE).
ALTER TABLE `Invoice` MODIFY COLUMN `status`
  ENUM('BROUILLON','VALIDEE','PAYEE','PARTIEL','EN_RETARD','ANNULEE') NOT NULL DEFAULT 'BROUILLON';
