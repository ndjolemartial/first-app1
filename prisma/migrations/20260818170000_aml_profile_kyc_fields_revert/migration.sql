-- Retour en arrière sur la migration 20260818160000_aml_profile_kyc_fields :
-- la « Fiche KYC » n'est finalement plus rattachée au profil de vigilance
-- (AmlProfile, Module 19 Conformité LBC/FT) mais directement au modèle
-- Client (cf. migration 20260818180000_client_kyc_complementary_fields).
ALTER TABLE `AmlProfile`
  DROP COLUMN `fatherName`,
  DROP COLUMN `motherName`,
  DROP COLUMN `profession`,
  DROP COLUMN `employerName`,
  DROP COLUMN `monthlyIncome`,
  DROP COLUMN `relationshipPurpose`,
  DROP COLUMN `expectedTransactionVolume`,
  DROP COLUMN `acquisitionChannel`,
  DROP COLUMN `kycSignedAt`,
  DROP COLUMN `kycSignedPlace`;
