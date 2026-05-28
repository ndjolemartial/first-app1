-- ── En-tête scindé en 2 blocs côte-à-côte ──
-- Remplace l'en-tête monobloc (`header` + `headerWidth` + `headerHeight`)
-- par 2 blocs indépendants disposés horizontalement. Chaque bloc peut
-- contenir du texte ou une image et possède sa propre largeur (% de la
-- page) et sa propre hauteur (px).
--
-- Choix utilisateur : les en-têtes existants sont réinitialisés à vide
-- (DROP COLUMN sur les anciennes colonnes — la donnée n'est pas migrée).

ALTER TABLE `ConventionTemplate`
    DROP COLUMN `header`,
    DROP COLUMN `headerWidth`,
    DROP COLUMN `headerHeight`,
    ADD COLUMN `headerLeft`        LONGTEXT NULL,
    ADD COLUMN `headerLeftWidth`   INT      NOT NULL DEFAULT 50,
    ADD COLUMN `headerLeftHeight`  INT      NOT NULL DEFAULT 140,
    ADD COLUMN `headerRight`       LONGTEXT NULL,
    ADD COLUMN `headerRightWidth`  INT      NOT NULL DEFAULT 50,
    ADD COLUMN `headerRightHeight` INT      NOT NULL DEFAULT 140;

ALTER TABLE `AttestationTemplate`
    DROP COLUMN `header`,
    DROP COLUMN `headerWidth`,
    DROP COLUMN `headerHeight`,
    ADD COLUMN `headerLeft`        LONGTEXT NULL,
    ADD COLUMN `headerLeftWidth`   INT      NOT NULL DEFAULT 50,
    ADD COLUMN `headerLeftHeight`  INT      NOT NULL DEFAULT 140,
    ADD COLUMN `headerRight`       LONGTEXT NULL,
    ADD COLUMN `headerRightWidth`  INT      NOT NULL DEFAULT 50,
    ADD COLUMN `headerRightHeight` INT      NOT NULL DEFAULT 140;
