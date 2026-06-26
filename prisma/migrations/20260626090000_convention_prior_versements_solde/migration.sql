-- Avenant de transfert de site / changement de lot d'une convention HÉRITÉE
-- (AVENANT_TRANSFERT_SITE_HERITE) : la convention initiale n'existe pas dans le
-- système, on saisit donc manuellement le total des versements antérieurs et le
-- solde antérieur. Alimentent les variables de template
-- {{convention.totalVersementsAnterieurs}} et {{convention.soldeAnterieur}}.

ALTER TABLE `Convention` ADD COLUMN `priorTotalVersements` DECIMAL(15, 2) NULL;
ALTER TABLE `Convention` ADD COLUMN `priorSolde` DECIMAL(15, 2) NULL;
