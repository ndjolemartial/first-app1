-- ── Largeurs initiales 25 % / 75 % pour l'en-tête à 2 blocs ──
-- Le bloc gauche est réduit de moitié au profit du bloc droit (qui
-- accueille typiquement les coordonnées détaillées de l'agence).
-- Migre la valeur par défaut de la colonne ET les enregistrements
-- existants qui sont restés sur le 50 / 50 d'origine.

ALTER TABLE `ConventionTemplate`
    MODIFY COLUMN `headerLeftWidth`  INT NOT NULL DEFAULT 25,
    MODIFY COLUMN `headerRightWidth` INT NOT NULL DEFAULT 75;

UPDATE `ConventionTemplate`
   SET `headerLeftWidth` = 25, `headerRightWidth` = 75
 WHERE `headerLeftWidth` = 50 AND `headerRightWidth` = 50;

ALTER TABLE `AttestationTemplate`
    MODIFY COLUMN `headerLeftWidth`  INT NOT NULL DEFAULT 25,
    MODIFY COLUMN `headerRightWidth` INT NOT NULL DEFAULT 75;

UPDATE `AttestationTemplate`
   SET `headerLeftWidth` = 25, `headerRightWidth` = 75
 WHERE `headerLeftWidth` = 50 AND `headerRightWidth` = 50;
