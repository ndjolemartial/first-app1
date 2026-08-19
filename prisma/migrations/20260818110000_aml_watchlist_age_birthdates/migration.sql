-- Ajoute un champ "Âge" (indicatif) et remplace la date de naissance unique
-- par une liste de dates de naissance connues (plusieurs valeurs fréquentes
-- pour une même personne sur les listes SFC/PPE sources).
ALTER TABLE `AmlWatchlist` ADD COLUMN `age` INT NULL AFTER `nationality`;
ALTER TABLE `AmlWatchlist` ADD COLUMN `birthDates` JSON NULL AFTER `age`;

-- Reprend la date de naissance déjà saisie dans le nouveau champ multi-valeurs
-- avant de retirer l'ancienne colonne.
UPDATE `AmlWatchlist` SET `birthDates` = JSON_ARRAY(DATE_FORMAT(`birthDate`, '%Y-%m-%d')) WHERE `birthDate` IS NOT NULL;

ALTER TABLE `AmlWatchlist` DROP COLUMN `birthDate`;
