-- Annulation : retrait du logo dans l'en-tête des factures.
-- La colonne `showLogo` n'est conservée que pour les exports de listes.
ALTER TABLE `InvoiceTemplate` DROP COLUMN `showLogo`;
