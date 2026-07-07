-- Couleur de fond des bandeaux de titre et des en-têtes de tableaux de la facture
-- (configurable par modèle de facture). Le trait latéral garde l'accent.
ALTER TABLE `InvoiceTemplate`
  ADD COLUMN `sectionColor` VARCHAR(191) NOT NULL DEFAULT '#d7dfe8';
