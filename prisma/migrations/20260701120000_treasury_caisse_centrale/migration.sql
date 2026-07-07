-- Ajoute le type de compte de trésorerie « Caisse centrale » (CAISSE_CENTRALE)
-- à l'énumération TreasuryAccountType (colonne BankAccount.type).
ALTER TABLE `BankAccount`
  MODIFY `type` ENUM('BANQUE', 'CAISSE', 'CAISSE_CENTRALE', 'MOBILE_MONEY') NOT NULL DEFAULT 'BANQUE';
