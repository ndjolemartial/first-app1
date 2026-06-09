-- AlterTable: grille de prix de vente par modalité de paiement (JSON).
-- { "CASH": 5000000, "SUR_6_MOIS": 5500000, "SUR_12_MOIS": 6000000, ... }
ALTER TABLE `Lotissement` ADD COLUMN `salePriceTiers` JSON NULL;
ALTER TABLE `Terrain` ADD COLUMN `salePriceTiers` JSON NULL;
ALTER TABLE `Property` ADD COLUMN `salePriceTiers` JSON NULL;
