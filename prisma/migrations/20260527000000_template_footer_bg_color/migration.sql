-- ── Couleur de fond du pied de page des modèles ──────────────
-- Ajoute la possibilité de personnaliser ou de retirer la couleur de fond
-- du footer des modèles de conventions et d'attestations.
--   NULL          ⇒ valeur par défaut historique (`#dc2626`, rouge)
--   `#rrggbb`     ⇒ couleur personnalisée
--   `transparent` ⇒ aucun fond
ALTER TABLE `ConventionTemplate`  ADD COLUMN `footerBgColor` VARCHAR(20) NULL;
ALTER TABLE `AttestationTemplate` ADD COLUMN `footerBgColor` VARCHAR(20) NULL;
