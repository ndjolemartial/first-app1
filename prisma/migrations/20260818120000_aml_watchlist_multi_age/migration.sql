-- Remplace l'âge unique par une liste d'âges connus (plusieurs valeurs
-- fréquentes pour une même personne, comme pour les dates de naissance).
ALTER TABLE `AmlWatchlist` ADD COLUMN `ages` JSON NULL AFTER `nationality`;

-- Reprend l'âge déjà saisi dans le nouveau champ multi-valeurs avant de
-- retirer l'ancienne colonne.
UPDATE `AmlWatchlist` SET `ages` = JSON_ARRAY(`age`) WHERE `age` IS NOT NULL;

ALTER TABLE `AmlWatchlist` DROP COLUMN `age`;
