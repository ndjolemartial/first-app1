-- Avenant de transfert de site / changement de lot d'une convention HÉRITÉE
-- (AVENANT_TRANSFERT_SITE_HERITE) : coût total des biens antérieurs, saisi
-- manuellement. Alimente la variable de template
-- {{convention.coutTotalBiensAnterieurs}} (convention et attestation).

ALTER TABLE `Convention` ADD COLUMN `priorTotalBiens` DECIMAL(15, 2) NULL;
