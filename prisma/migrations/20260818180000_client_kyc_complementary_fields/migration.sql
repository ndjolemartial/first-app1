-- Bloc « Informations complémentaires » de la fiche client — alimente la
-- « Fiche KYC » imprimable depuis la fiche client (bouton dédié). Réutilise
-- l'enum AmlPepCategory déjà existant (Module 19) plutôt que d'en dupliquer
-- un identique.
ALTER TABLE `Client`
  ADD COLUMN `employerName` VARCHAR(191) NULL AFTER `motherLastName`,
  ADD COLUMN `monthlyIncome` DECIMAL(15, 2) NULL AFTER `employerName`,
  ADD COLUMN `sourceOfFunds` TEXT NULL AFTER `monthlyIncome`,
  ADD COLUMN `sourceOfWealth` TEXT NULL AFTER `sourceOfFunds`,
  ADD COLUMN `relationshipPurpose` TEXT NULL AFTER `sourceOfWealth`,
  ADD COLUMN `expectedTransactionVolume` DECIMAL(15, 2) NULL AFTER `relationshipPurpose`,
  ADD COLUMN `acquisitionChannel` VARCHAR(191) NULL AFTER `expectedTransactionVolume`,
  ADD COLUMN `isPep` BOOLEAN NOT NULL DEFAULT false AFTER `acquisitionChannel`,
  ADD COLUMN `pepCategory` ENUM('PEP_NATIONAL', 'PEP_ETRANGER', 'PEP_ORGANISATION_INTERNATIONALE', 'PERSONNE_LIEE_PEP') NULL AFTER `isPep`,
  ADD COLUMN `pepFunction` VARCHAR(191) NULL AFTER `pepCategory`,
  ADD COLUMN `hasRiskyCountryLink` BOOLEAN NOT NULL DEFAULT false AFTER `pepFunction`,
  ADD COLUMN `kycSignedAt` DATETIME(3) NULL AFTER `hasRiskyCountryLink`,
  ADD COLUMN `kycSignedPlace` VARCHAR(191) NULL AFTER `kycSignedAt`;
