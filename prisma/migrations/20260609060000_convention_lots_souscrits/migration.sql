-- Stocke l'énumération des lots souscrits sur la convention (figée à l'édition),
-- pour l'afficher sur les factures en face de la référence de convention.
ALTER TABLE `Convention` ADD COLUMN `lotsSouscrits` TEXT NULL;
