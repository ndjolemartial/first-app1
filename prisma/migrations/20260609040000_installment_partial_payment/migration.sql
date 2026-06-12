-- AlterTable: SaleInstallment — paiement partiel.
-- `paidAmount` suit le cumul encaissé ; le statut PARTIEL est utilisé tant que
-- 0 < paidAmount < amount.
ALTER TABLE `SaleInstallment` ADD COLUMN `paidAmount` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- AlterEnum : ajout du statut PARTIEL (avant PAYE).
ALTER TABLE `SaleInstallment` MODIFY `status` ENUM('EN_ATTENTE', 'A_REGLER', 'PARTIEL', 'PAYE', 'EN_RETARD', 'ANNULE') NOT NULL DEFAULT 'EN_ATTENTE';
