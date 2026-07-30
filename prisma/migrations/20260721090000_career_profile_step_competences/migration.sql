-- ════════════════════════════════════════════════════════════════════
-- Migration : Compétences et diplômes requis par étape de profil de carrière
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `CareerProfileStep`
  ADD COLUMN `competencesDiplomes` TEXT NULL;
