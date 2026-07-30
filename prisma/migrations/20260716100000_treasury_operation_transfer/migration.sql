-- ════════════════════════════════════════════════════════════════════
-- Migration : Virement interne compte à compte (Nouvelle opération de
-- trésorerie)
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Permettre, sur une opération ENTREE, de préciser un « Compte débit »
--     (en plus du compte principal renommé « Compte crédit ») — et sur une
--     opération SORTIE, un « Compte crédit » (le compte principal étant
--     renommé « Compte débit »). Quand ce second compte est renseigné, une
--     seconde écriture (sens opposé) est posée dessus, liée à la première
--     via `transferGroupId`.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `TreasuryOperation`
  ADD COLUMN `transferGroupId` VARCHAR(191) NULL;

CREATE INDEX `TreasuryOperation_transferGroupId_idx` ON `TreasuryOperation`(`transferGroupId`);

ALTER TABLE `TreasuryOperation`
  MODIFY COLUMN `source` ENUM('MANUEL', 'FACTURE', 'ECHEANCE', 'COMMISSION', 'PAIE', 'CHARGE', 'TRANSFERT') NOT NULL DEFAULT 'MANUEL';
