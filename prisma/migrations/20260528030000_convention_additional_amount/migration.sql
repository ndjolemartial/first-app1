-- ── Avenant de transfert de site : montant supplémentaire ──────
-- Un avenant de transfert de site / changement de lot peut induire
-- le paiement d'un montant supplémentaire par le client (différence
-- de prix entre l'ancien et le nouveau lot, frais d'avenant, etc.).
-- Stocké en Decimal(15,2), NULL si non applicable.
ALTER TABLE `Convention` ADD COLUMN `additionalAmount` DECIMAL(15, 2) NULL;
