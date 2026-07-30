-- ════════════════════════════════════════════════════════════════════
-- Migration : CareerProfileStep.description → rolePrincipal
-- ════════════════════════════════════════════════════════════════════
-- Le champ texte libre par étape de filière est désormais explicitement le
-- « rôle principal » (mission essentielle) occupé à ce niveau, plutôt qu'une
-- description générique. Renommage de colonne — données conservées.

ALTER TABLE `CareerProfileStep`
  CHANGE COLUMN `description` `rolePrincipal` TEXT NULL;
