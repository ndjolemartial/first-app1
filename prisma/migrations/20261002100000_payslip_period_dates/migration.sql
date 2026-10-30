-- Dates de période personnalisées d'un bulletin de paie (affichage de la
-- ligne « Période du … au … ») ; NULL = 1er/dernier jour du mois de paie.
ALTER TABLE `Payslip`
  ADD COLUMN `periodStartDate` DATETIME(3) NULL,
  ADD COLUMN `periodEndDate` DATETIME(3) NULL;
