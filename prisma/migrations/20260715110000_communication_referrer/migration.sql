-- ════════════════════════════════════════════════════════════════════
-- Migration : Envoyer un message — cibler un apporteur d'affaires
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Ajouter à Communication un rattachement optionnel vers
--     BusinessReferrer, au même titre que Client/Owner/Convention, pour
--     l'entité « Apporteur d'affaires » du bloc « Cibler une entité » de
--     l'interface Envoyer un message.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `Communication`
  ADD COLUMN `referrerId` INTEGER NULL;

CREATE INDEX `Communication_referrerId_idx` ON `Communication`(`referrerId`);

ALTER TABLE `Communication`
  ADD CONSTRAINT `Communication_referrerId_fkey`
  FOREIGN KEY (`referrerId`) REFERENCES `BusinessReferrer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
