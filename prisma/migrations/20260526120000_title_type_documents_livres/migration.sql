-- ── LotissementTitleType — Documents livrés avec terrains ─────
-- Description libre (multi-lignes) des documents administratifs remis au
-- client lors de la livraison d'un terrain associé à ce titre. Substitué
-- dans les modèles via la variable `{{lotissement.documentsLivres}}`.
ALTER TABLE `LotissementTitleType` ADD COLUMN `documentsLivres` TEXT NULL;
