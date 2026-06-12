-- ════════════════════════════════════════════════════════════════════
-- Migration : catégorie sur les lignes de devis (QuoteItem.category)
-- ════════════════════════════════════════════════════════════════════
-- Permet de disposer le contenu d'un devis par blocs et de calculer un
-- sous-total par catégorie. Colonne nullable (additive).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE `QuoteItem` ADD COLUMN `category` VARCHAR(191) NULL;
