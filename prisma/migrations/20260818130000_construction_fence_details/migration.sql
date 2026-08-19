-- Détail de la clôture : crépissage (oui/non) et type de poteaux (sortants
-- ou simples), pour que le devis affiche ces rubriques séparément et que
-- leur coût dépende de ces choix.
ALTER TABLE `ConstructionProject`
  ADD COLUMN `fenceHasCrepissage` BOOLEAN NOT NULL DEFAULT false AFTER `fenceHeight`,
  ADD COLUMN `fencePostType` ENUM('POTEAUX_SORTANTS', 'POTEAUX_SIMPLES') NOT NULL DEFAULT 'POTEAUX_SIMPLES' AFTER `fenceHasCrepissage`;
