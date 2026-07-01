-- Zones En-tête / Pied de page / Fin du document pour les modèles de contrats
-- de travail (parité avec ConventionTemplate). Rendu PDF avec en-tête/pied
-- répétés sur chaque page.
ALTER TABLE `ContractTemplate`
  ADD COLUMN `header` LONGTEXT NULL,
  ADD COLUMN `headerWidth` INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN `headerHeight` INTEGER NOT NULL DEFAULT 140,
  ADD COLUMN `footer` LONGTEXT NULL,
  ADD COLUMN `footerWidth` INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN `footerHeight` INTEGER NOT NULL DEFAULT 140,
  ADD COLUMN `footerBgColor` VARCHAR(20) NULL,
  ADD COLUMN `endOfDocument` LONGTEXT NULL,
  ADD COLUMN `endOfDocumentWidth` INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN `endOfDocumentHeight` INTEGER NOT NULL DEFAULT 140,
  ADD COLUMN `endOfDocumentBgColor` VARCHAR(20) NULL;
