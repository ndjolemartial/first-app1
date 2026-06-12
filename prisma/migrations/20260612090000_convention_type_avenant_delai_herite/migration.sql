-- AlterEnum: ajout du type de convention AVENANT_DELAI_HERITE
-- (« Avenant Délai - convention héritée » : avenant de prolongation de délai
--  applicable à une convention importée de la base héritée, sans convention
--  parente dans l'application — saisie libre des terrains / client / dates).
ALTER TABLE `Convention` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION', 'AVENANT_DELAI_HERITE') NOT NULL;
ALTER TABLE `ConventionTemplate` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION', 'AVENANT_DELAI_HERITE') NOT NULL;
