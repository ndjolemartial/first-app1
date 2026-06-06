-- ── Option « Afficher le logo » sur les modèles de factures et d'export de listes ──
ALTER TABLE `InvoiceTemplate`    ADD COLUMN `showLogo` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `ListExportTemplate` ADD COLUMN `showLogo` BOOLEAN NOT NULL DEFAULT true;
