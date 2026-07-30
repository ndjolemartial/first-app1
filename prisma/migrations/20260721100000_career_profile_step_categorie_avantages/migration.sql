-- ════════════════════════════════════════════════════════════════════
-- Migration : Catégorie socio-professionnelle + avantages par étape
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `CareerProfileStep`
  ADD COLUMN `categorieSocioPro` VARCHAR(191) NULL,
  ADD COLUMN `avantages` TEXT NULL;
