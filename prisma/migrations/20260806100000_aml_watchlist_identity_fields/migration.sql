-- Module 19 (suite) — Référentiel de vigilance : champs d'identité complets
-- (nom et prénoms, sexe, date/lieu de naissance, proches, situation
-- matrimoniale, nationalité, langue, résidence, adresse, téléphone,
-- profession, motif). Généré via `prisma migrate diff --from-url ...
-- --to-schema-datamodel prisma/schema.prisma --script` puis restreint aux
-- seules instructions liées à cet ajout (le diff brut incluait aussi la
-- même dérive de schéma préexistante et sans rapport que les précédentes
-- migrations AML — Commission/SaleInstallment/ProjectPhoto/
-- DocumentFolderAccess FKs, Project/ProjectType/ReminderRule — volontairement
-- exclue ici aussi).

-- AlterTable
ALTER TABLE `AmlWatchlist` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `birthPlace` VARCHAR(191) NULL,
    ADD COLUMN `maritalStatus` ENUM('CELIBATAIRE', 'MARIEE', 'CONCUBINAGE', 'DIVORCE', 'VEUF') NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `profession` VARCHAR(191) NULL,
    ADD COLUMN `reason` TEXT NULL,
    ADD COLUMN `relatedPersons` TEXT NULL,
    ADD COLUMN `residenceCountry` VARCHAR(191) NULL,
    ADD COLUMN `sex` VARCHAR(191) NULL,
    ADD COLUMN `spokenLanguage` VARCHAR(191) NULL;
