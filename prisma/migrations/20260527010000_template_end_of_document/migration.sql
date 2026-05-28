-- ── Bloc « Fin du document » sur les modèles de conventions / attestations ──
-- Bloc HTML inséré à la suite du corps du document (signatures, mentions
-- légales finales…). Mêmes contrôles que le pied de page : largeur en %,
-- hauteur en px, couleur de fond optionnelle.
ALTER TABLE `ConventionTemplate`
    ADD COLUMN `endOfDocument`        LONGTEXT     NULL,
    ADD COLUMN `endOfDocumentWidth`   INT          NOT NULL DEFAULT 100,
    ADD COLUMN `endOfDocumentHeight`  INT          NOT NULL DEFAULT 140,
    ADD COLUMN `endOfDocumentBgColor` VARCHAR(20)  NULL;

ALTER TABLE `AttestationTemplate`
    ADD COLUMN `endOfDocument`        LONGTEXT     NULL,
    ADD COLUMN `endOfDocumentWidth`   INT          NOT NULL DEFAULT 100,
    ADD COLUMN `endOfDocumentHeight`  INT          NOT NULL DEFAULT 140,
    ADD COLUMN `endOfDocumentBgColor` VARCHAR(20)  NULL;
