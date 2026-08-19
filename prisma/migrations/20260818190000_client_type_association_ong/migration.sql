-- AlterEnum : ajout de ASSOCIATION_ONG à ClientType (Client.type et Owner.type
-- partagent cet enum) — personne morale, mêmes champs de saisie qu'ENTREPRISE.
ALTER TABLE `Client` MODIFY COLUMN `type` ENUM('INDIVIDUEL', 'ENTREPRISE', 'ASSOCIATION_ONG') NOT NULL DEFAULT 'INDIVIDUEL';
ALTER TABLE `Owner` MODIFY COLUMN `type` ENUM('INDIVIDUEL', 'ENTREPRISE', 'ASSOCIATION_ONG') NOT NULL DEFAULT 'INDIVIDUEL';
