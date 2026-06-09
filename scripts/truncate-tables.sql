-- Vidage (TRUNCATE) des tables demandées — réinitialise aussi les auto-increment.
-- FK désactivées le temps de l'opération (les tables se référencent mutuellement).
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE `Client`;
TRUNCATE TABLE `Prospect`;
TRUNCATE TABLE `Lotissement`;
TRUNCATE TABLE `Project`;
TRUNCATE TABLE `LotissementTitleType`;
TRUNCATE TABLE `DocumentTag`;
TRUNCATE TABLE `DocumentFolder`;
TRUNCATE TABLE `DocumentCategory`;
TRUNCATE TABLE `DocumentAuditLog`;
TRUNCATE TABLE `Document`;
TRUNCATE TABLE `CrmActivity`;
TRUNCATE TABLE `Communication`;
TRUNCATE TABLE `BudgetLine`;
TRUNCATE TABLE `Budget`;
TRUNCATE TABLE `ProgrammeImmobilier`;

SET FOREIGN_KEY_CHECKS = 1;
