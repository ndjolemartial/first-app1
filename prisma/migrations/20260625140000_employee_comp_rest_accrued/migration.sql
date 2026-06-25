-- Repos compensateur : compteur de jours acquis géré manuellement par les RH.
ALTER TABLE `Employee` ADD COLUMN `compRestAccrued` DECIMAL(5, 1) NOT NULL DEFAULT 0;
