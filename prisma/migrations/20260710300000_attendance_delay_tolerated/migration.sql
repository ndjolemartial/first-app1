-- ════════════════════════════════════════════════════════════════════
-- Migration : Retards & Départs précipités — statut « Toléré »
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Ajouter à AttendanceDelayJustification un second statut « tolerated »,
--     distinct de « justified » (pas de demande de congé / activité CRM liée,
--     marquage manuel SUPER_ADMIN/ADMIN/MANAGER plafonné par une limite de
--     temps paramétrable).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `AttendanceDelayJustification`
  ADD COLUMN `tolerated` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `toleratedById` INTEGER NULL,
  ADD COLUMN `toleratedAt` DATETIME(3) NULL;

ALTER TABLE `AttendanceDelayJustification`
  ADD CONSTRAINT `AttendanceDelayJustification_toleratedById_fkey`
  FOREIGN KEY (`toleratedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
