-- ── CONVENTION — Frais d'ouverture de dossier ─────────────────
-- Montant facturé au client à la signature de la convention.
ALTER TABLE `Convention` ADD COLUMN `fraisOuvertureDossier` DECIMAL(15, 2) NULL;
