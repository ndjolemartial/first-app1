-- ════════════════════════════════════════════════════════════════════
-- Migration : nouvelle valeur d'énumération PaymentMethod « PRELEVEMENT »
-- (Prélèvement bancaire), ajoutée à la suite de MOBILE_MONEY sur les 7
-- colonnes qui utilisent ce type. NOT NULL / DEFAULT conservés à
-- l'identique pour chaque colonne (aucun changement de comportement).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `Convention`
  MODIFY COLUMN `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NOT NULL DEFAULT 'ESPECE';

ALTER TABLE `SaleInstallment`
  MODIFY COLUMN `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NULL;

ALTER TABLE `Commission`
  MODIFY COLUMN `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NULL;

ALTER TABLE `TreasuryOperation`
  MODIFY COLUMN `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NOT NULL DEFAULT 'ESPECE';

ALTER TABLE `ForecastExpense`
  MODIFY COLUMN `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NULL;

ALTER TABLE `Payslip`
  MODIFY COLUMN `paymentMethod` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NULL;

ALTER TABLE `Payment`
  MODIFY COLUMN `method` ENUM('ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY', 'PRELEVEMENT', 'NON_DEFINI') NOT NULL;
