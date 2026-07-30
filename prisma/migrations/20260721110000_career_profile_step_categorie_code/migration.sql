-- ════════════════════════════════════════════════════════════════════
-- Migration : Code exact de la catégorie socio-professionnelle par étape
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `CareerProfileStep`
  ADD COLUMN `categorieCode` VARCHAR(191) NULL;
