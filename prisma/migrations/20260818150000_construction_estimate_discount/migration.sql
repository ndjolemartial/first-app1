-- Remise globale sur une estimation de devis de construction — même
-- principe que Quote.discountAmount/discountIsPercent/discountPercent.
ALTER TABLE `ConstructionEstimate`
  ADD COLUMN `discountAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER `puRoundingStep`,
  ADD COLUMN `discountIsPercent` BOOLEAN NOT NULL DEFAULT false AFTER `discountAmount`,
  ADD COLUMN `discountPercent` DECIMAL(5, 2) NULL AFTER `discountIsPercent`,
  ADD COLUMN `subtotalHT` DECIMAL(15, 2) NOT NULL DEFAULT 0 AFTER `totalMarge`;

-- Reprise des estimations déjà générées : sous-total = total HT existant
-- (aucune remise n'existait avant ce champ).
UPDATE `ConstructionEstimate` SET `subtotalHT` = `totalHT`;
