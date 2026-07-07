-- Couleurs de texte des bandeaux de titre et des en-têtes de tableaux de la
-- facture, configurables par modèle de facture.
ALTER TABLE `InvoiceTemplate`
  ADD COLUMN `sectionTextColor` VARCHAR(191) NOT NULL DEFAULT '#0f172a',
  ADD COLUMN `tableHeaderTextColor` VARCHAR(191) NOT NULL DEFAULT '#0f172a';
