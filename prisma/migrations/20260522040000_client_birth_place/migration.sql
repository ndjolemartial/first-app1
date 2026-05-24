-- ════════════════════════════════════════════════════════════════════
-- Migration : ajoute le champ `birthPlace` (lieu de naissance) au Client
-- ════════════════════════════════════════════════════════════════════
-- Champ optionnel rempli pour les personnes physiques (INDIVIDUEL).
-- Exposé dans les modèles de convention et d'attestation via les
-- variables `{{client.lieuNaissance}}` et `{{cedant.lieuNaissance}}`.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `Client`
  ADD COLUMN `birthPlace` VARCHAR(191) NULL AFTER `birthDate`;
