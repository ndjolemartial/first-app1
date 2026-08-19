-- « Objet de la relation d'affaires » devient une sélection multiple (liste
-- fermée + « Autre, à préciser ») plutôt qu'un champ de texte libre, même
-- principe que sourceOfFunds (migration 20260818200000). Aucun client n'avait
-- encore de valeur renseignée sur ce champ — conversion directe.
ALTER TABLE `Client`
  DROP COLUMN `relationshipPurpose`,
  ADD COLUMN `relationshipPurpose` JSON NULL AFTER `sourceOfWealth`,
  ADD COLUMN `relationshipPurposeOther` VARCHAR(191) NULL AFTER `relationshipPurpose`;
