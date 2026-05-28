-- ── Retour à l'en-tête monobloc ──
-- Restaure les colonnes `header` / `headerWidth` / `headerHeight` et
-- supprime les 6 colonnes du découpage gauche/droite. Le contenu des 2
-- blocs précédents est concaténé dans le nouveau `header` (gauche puis
-- droit) ; la hauteur du bloc reprend la plus grande des 2 hauteurs.
-- L'image insérée occupera ensuite 100 % de la largeur du bloc (CSS du
-- rendu PDF dans `ConventionDocumentPage` / `AttestationDocumentPage`).

-- ── ConventionTemplate ──
ALTER TABLE `ConventionTemplate`
    ADD COLUMN `header`       LONGTEXT NULL,
    ADD COLUMN `headerWidth`  INT      NOT NULL DEFAULT 100,
    ADD COLUMN `headerHeight` INT      NOT NULL DEFAULT 140;

UPDATE `ConventionTemplate`
   SET `header`       = CONCAT(IFNULL(`headerLeft`, ''), IFNULL(`headerRight`, '')),
       `headerHeight` = GREATEST(`headerLeftHeight`, `headerRightHeight`)
 WHERE `headerLeft` IS NOT NULL OR `headerRight` IS NOT NULL;

ALTER TABLE `ConventionTemplate`
    DROP COLUMN `headerLeft`,
    DROP COLUMN `headerLeftWidth`,
    DROP COLUMN `headerLeftHeight`,
    DROP COLUMN `headerRight`,
    DROP COLUMN `headerRightWidth`,
    DROP COLUMN `headerRightHeight`;

-- ── AttestationTemplate ──
ALTER TABLE `AttestationTemplate`
    ADD COLUMN `header`       LONGTEXT NULL,
    ADD COLUMN `headerWidth`  INT      NOT NULL DEFAULT 100,
    ADD COLUMN `headerHeight` INT      NOT NULL DEFAULT 140;

UPDATE `AttestationTemplate`
   SET `header`       = CONCAT(IFNULL(`headerLeft`, ''), IFNULL(`headerRight`, '')),
       `headerHeight` = GREATEST(`headerLeftHeight`, `headerRightHeight`)
 WHERE `headerLeft` IS NOT NULL OR `headerRight` IS NOT NULL;

ALTER TABLE `AttestationTemplate`
    DROP COLUMN `headerLeft`,
    DROP COLUMN `headerLeftWidth`,
    DROP COLUMN `headerLeftHeight`,
    DROP COLUMN `headerRight`,
    DROP COLUMN `headerRightWidth`,
    DROP COLUMN `headerRightHeight`;
