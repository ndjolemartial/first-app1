-- AlterTable: SaleInstallment — détails de souscription hérités de l'ancienne
-- application. Affichés sur la facture à la place de la référence de convention
-- pour les échéances héritées (sans convention).
ALTER TABLE `SaleInstallment` ADD COLUMN `detailsSouscription` TEXT NULL;
