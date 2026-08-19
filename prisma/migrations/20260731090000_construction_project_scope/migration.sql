-- Portée du devis de construction (Module 17) : COMPLET (maison entière,
-- 22 lots) ou restreinte à un seul lot ancillaire — clôture ou piscine.
-- Le moteur (computeEstimate, lotCodeFilter) ignore les autres lots pour
-- ces deux portées, sauf LOT01/LOT22 (installation de chantier / nettoyage).

-- AlterTable
ALTER TABLE `ConstructionProject`
  ADD COLUMN `scope` ENUM('COMPLET', 'CLOTURE_SEULE', 'PISCINE_SEULE') NOT NULL DEFAULT 'COMPLET' AFTER `status`;
