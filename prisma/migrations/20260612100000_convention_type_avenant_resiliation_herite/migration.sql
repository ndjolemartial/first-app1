-- AlterEnum: ajout du type de convention AVENANT_RESILIATION_HERITE
-- (« Avenant Résiliation - convention héritée » : résiliation applicable à une
--  convention importée de la base héritée, sans convention parente dans
--  l'application — saisie libre des terrains / client / dates).
ALTER TABLE `Convention` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION', 'AVENANT_DELAI_HERITE', 'AVENANT_RESILIATION_HERITE') NOT NULL;
ALTER TABLE `ConventionTemplate` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION', 'AVENANT_DELAI_HERITE', 'AVENANT_RESILIATION_HERITE') NOT NULL;
