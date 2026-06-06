-- ── Bloc « Fin du document » sur les modèles de factures et d'export de listes ──
-- Bloc HTML inséré à la suite du corps du document (signatures, mentions
-- légales finales…), avant le pied de page.
ALTER TABLE `InvoiceTemplate`    ADD COLUMN `endOfDocument` LONGTEXT NULL;
ALTER TABLE `ListExportTemplate` ADD COLUMN `endOfDocument` LONGTEXT NULL;
