-- ════════════════════════════════════════════════════════════════════
-- Migration : sous-type pour les conventions de souscription
-- ════════════════════════════════════════════════════════════════════
-- Ajoute la colonne `souscriptionType` à la table Convention.
-- Rempli uniquement quand `type = 'SOUSCRIPTION'` :
--   STANDARD            — Convention de souscription
--   AVEC_ACD            — Convention de souscription avec ACD
--   FINANCEMENT_PROJET  — Convention de financement sur projet
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `Convention`
  ADD COLUMN `souscriptionType` ENUM('STANDARD','AVEC_ACD','FINANCEMENT_PROJET') NULL AFTER `amendmentType`;
