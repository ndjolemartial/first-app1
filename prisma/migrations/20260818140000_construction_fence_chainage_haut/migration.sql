-- Chaînage haut optionnel de la clôture — rubrique distincte, affecte le
-- montant du devis selon qu'elle est intégrée ou non.
ALTER TABLE `ConstructionProject`
  ADD COLUMN `fenceHasChainageHaut` BOOLEAN NOT NULL DEFAULT false AFTER `fenceHasCrepissage`;
