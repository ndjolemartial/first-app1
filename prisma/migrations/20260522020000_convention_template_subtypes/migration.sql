-- ════════════════════════════════════════════════════════════════════
-- Migration : sous-types pour les modèles de convention
-- ════════════════════════════════════════════════════════════════════
-- Ajoute deux colonnes optionnelles à `ConventionTemplate` :
--   amendmentType    — nature précise quand `type = 'AVENANT'`
--   souscriptionType — nature précise quand `type = 'SOUSCRIPTION'`
-- Laissées vides, le modèle couvre toutes les natures de son type.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `ConventionTemplate`
  ADD COLUMN `amendmentType`    ENUM('PROLONGATION_DELAI','TRANSFERT_PROPRIETE','TRANSFERT_SITE') NULL AFTER `type`,
  ADD COLUMN `souscriptionType` ENUM('STANDARD','AVEC_ACD','FINANCEMENT_PROJET')                  NULL AFTER `amendmentType`;
