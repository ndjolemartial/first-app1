-- « Origine des fonds » devient une sélection multiple (liste fermée de
-- sources usuelles + « Autre, à préciser ») plutôt qu'un champ de texte
-- libre. Aucun client n'avait encore de valeur renseignée sur ce champ
-- (fonctionnalité livrée le jour même) — conversion directe sans migration
-- de données.
ALTER TABLE `Client`
  DROP COLUMN `sourceOfFunds`,
  ADD COLUMN `sourceOfFunds` JSON NULL AFTER `monthlyIncome`,
  ADD COLUMN `sourceOfFundsOther` VARCHAR(191) NULL AFTER `sourceOfFunds`;
