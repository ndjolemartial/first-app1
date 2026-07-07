-- Couleur de fond des en-têtes de tableaux de la facture, distincte de celle des
-- bandeaux de titre (sectionColor). Configurable par modèle de facture.
ALTER TABLE `InvoiceTemplate`
  ADD COLUMN `tableHeaderColor` VARCHAR(191) NOT NULL DEFAULT '#e2e8f0';
