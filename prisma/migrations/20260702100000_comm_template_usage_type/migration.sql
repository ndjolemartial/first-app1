-- Catégorie d'usage des modèles de messages : AUTO (relances automatiques) ou
-- MANUEL (envois manuels). Les modèles existants deviennent MANUEL par défaut.
ALTER TABLE `CommTemplate`
  ADD COLUMN `usageType` ENUM('AUTO', 'MANUEL') NOT NULL DEFAULT 'MANUEL';
