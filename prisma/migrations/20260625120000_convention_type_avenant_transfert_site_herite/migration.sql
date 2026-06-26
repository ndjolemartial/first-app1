-- AlterEnum: ajout du type de convention AVENANT_TRANSFERT_SITE_HERITE
-- (« Avenant transfert de Site ou de Lot - convention héritée » : avenant de
--  transfert de site / changement de lot applicable à une convention importée de
--  la base héritée, sans convention parente dans l'application — saisie libre des
--  terrains / client / dates, mêmes informations que l'avenant délai hérité).
ALTER TABLE `Convention` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION', 'AVENANT_DELAI_HERITE', 'AVENANT_RESILIATION_HERITE', 'AVENANT_TRANSFERT_SITE_HERITE') NOT NULL;
ALTER TABLE `ConventionTemplate` MODIFY `type` ENUM('RENTAL_UNFURNISHED', 'RENTAL_FURNISHED', 'SALE', 'MANAGEMENT', 'COMMERCIAL_LEASE', 'SOUSCRIPTION', 'AVENANT', 'RESILIATION', 'AVENANT_DELAI_HERITE', 'AVENANT_RESILIATION_HERITE', 'AVENANT_TRANSFERT_SITE_HERITE') NOT NULL;
