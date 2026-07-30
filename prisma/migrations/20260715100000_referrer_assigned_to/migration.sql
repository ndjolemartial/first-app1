-- ════════════════════════════════════════════════════════════════════
-- Migration : Apporteurs d'affaire — utilisateur référent
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Permettre de rattacher un compte utilisateur interne (agent référent)
--     à un apporteur d'affaire (BusinessReferrer), même principe que
--     Client.assignedToId / Prospect.assignedToId.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `BusinessReferrer`
  ADD COLUMN `assignedToId` INTEGER NULL;

ALTER TABLE `BusinessReferrer`
  ADD CONSTRAINT `BusinessReferrer_assignedToId_fkey`
  FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
