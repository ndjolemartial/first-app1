-- Vidage des données comptables + conventions (conserve les comptes de trésorerie).
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Détacher les références vers les entités vidées (évite des associations
--    erronées après la réinitialisation des compteurs AUTO_INCREMENT par TRUNCATE).
--    On conserve Document.attestationId (les attestations ne sont pas vidées).
UPDATE `Document` SET `conventionId` = NULL, `invoiceId` = NULL, `commissionId` = NULL
  WHERE `conventionId` IS NOT NULL OR `invoiceId` IS NOT NULL OR `commissionId` IS NOT NULL;
UPDATE `CrmActivity` SET `conventionId` = NULL, `invoiceId` = NULL, `installmentId` = NULL
  WHERE `conventionId` IS NOT NULL OR `invoiceId` IS NOT NULL OR `installmentId` IS NOT NULL;
UPDATE `Communication` SET `conventionId` = NULL WHERE `conventionId` IS NOT NULL;
UPDATE `Attestation` SET `conventionId` = NULL WHERE `conventionId` IS NOT NULL;

-- 2) Vidage (réinitialise les AUTO_INCREMENT)
TRUNCATE TABLE `Payment`;
TRUNCATE TABLE `InvoiceItem`;
TRUNCATE TABLE `SaleInstallment`;
TRUNCATE TABLE `Commission`;
TRUNCATE TABLE `TreasuryOperation`;
TRUNCATE TABLE `Invoice`;
TRUNCATE TABLE `ConventionProperty`;
TRUNCATE TABLE `ConventionTerrain`;
TRUNCATE TABLE `Convention`;

SET FOREIGN_KEY_CHECKS = 1;
