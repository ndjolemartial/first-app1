-- Champs propres à la « Fiche KYC » (Prospects & Clients), qui réutilise le
-- profil de vigilance existant (AmlProfile, Module 19) — filiation, situation
-- professionnelle, revenus, objet de la relation d'affaires, signature.
ALTER TABLE `AmlProfile`
  ADD COLUMN `fatherName` VARCHAR(191) NULL AFTER `sourceOfWealth`,
  ADD COLUMN `motherName` VARCHAR(191) NULL AFTER `fatherName`,
  ADD COLUMN `profession` VARCHAR(191) NULL AFTER `motherName`,
  ADD COLUMN `employerName` VARCHAR(191) NULL AFTER `profession`,
  ADD COLUMN `monthlyIncome` DECIMAL(15, 2) NULL AFTER `employerName`,
  ADD COLUMN `relationshipPurpose` TEXT NULL AFTER `monthlyIncome`,
  ADD COLUMN `expectedTransactionVolume` DECIMAL(15, 2) NULL AFTER `relationshipPurpose`,
  ADD COLUMN `acquisitionChannel` VARCHAR(191) NULL AFTER `expectedTransactionVolume`,
  ADD COLUMN `kycSignedAt` DATETIME(3) NULL AFTER `acquisitionChannel`,
  ADD COLUMN `kycSignedPlace` VARCHAR(191) NULL AFTER `kycSignedAt`;
