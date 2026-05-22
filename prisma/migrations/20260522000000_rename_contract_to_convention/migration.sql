-- ════════════════════════════════════════════════════════════════════
-- Migration : renommage du module « Contrats » en « Conventions »
-- ════════════════════════════════════════════════════════════════════
--  Tables                  : Contract → Convention, ContractTemplate → ConventionTemplate
--  Colonnes FK             : contractId → conventionId, parentContractId → parentConventionId
--  Enums                   : ArchiveEntityType.CONTRACT → CONVENTION
--                            ArchiveReason.CONTRAT_TERMINE → CONVENTION_TERMINEE
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Suppression des contraintes FK pointant vers Contract ─────────
ALTER TABLE `Invoice`         DROP FOREIGN KEY `Invoice_contractId_fkey`;
ALTER TABLE `SaleInstallment` DROP FOREIGN KEY `SaleInstallment_contractId_fkey`;
ALTER TABLE `CrmActivity`     DROP FOREIGN KEY `CrmActivity_contractId_fkey`;
ALTER TABLE `Document`        DROP FOREIGN KEY `Document_contractId_fkey`;
ALTER TABLE `Commission`      DROP FOREIGN KEY `Commission_contractId_fkey`;

-- Auto-référence Contract → Contract (parentContractId)
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_parentContractId_fkey`;

-- ── 2. Suppression des contraintes FK depuis Contract ────────────────
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_propertyId_fkey`;
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_terrainId_fkey`;
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_clientId_fkey`;
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_secondaryClientId_fkey`;
ALTER TABLE `Contract` DROP FOREIGN KEY `Contract_agentId_fkey`;

-- ── 3. Renommage des tables ──────────────────────────────────────────
RENAME TABLE `Contract`         TO `Convention`;
RENAME TABLE `ContractTemplate` TO `ConventionTemplate`;

-- ── 4. Renommage des index uniques (alignement avec Prisma) ──────────
ALTER TABLE `Convention`         RENAME INDEX `Contract_uuid_key`         TO `Convention_uuid_key`;
ALTER TABLE `Convention`         RENAME INDEX `Contract_reference_key`    TO `Convention_reference_key`;
ALTER TABLE `ConventionTemplate` RENAME INDEX `ContractTemplate_uuid_key` TO `ConventionTemplate_uuid_key`;

-- ── 5. Renommage de la colonne parentContractId ──────────────────────
ALTER TABLE `Convention` CHANGE COLUMN `parentContractId` `parentConventionId` INTEGER NULL;

-- ── 6. Renommage des colonnes FK contractId → conventionId ───────────
ALTER TABLE `Invoice`         CHANGE COLUMN `contractId` `conventionId` INTEGER NULL;
ALTER TABLE `SaleInstallment` CHANGE COLUMN `contractId` `conventionId` INTEGER NOT NULL;
ALTER TABLE `CrmActivity`     CHANGE COLUMN `contractId` `conventionId` INTEGER NULL;
ALTER TABLE `Document`        CHANGE COLUMN `contractId` `conventionId` INTEGER NULL;
ALTER TABLE `Commission`      CHANGE COLUMN `contractId` `conventionId` INTEGER NOT NULL;

-- ── 7. Recréation des contraintes FK ─────────────────────────────────
-- Auto-référence Convention → Convention
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_parentConventionId_fkey`
  FOREIGN KEY (`parentConventionId`) REFERENCES `Convention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- FK Convention → autres tables
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_propertyId_fkey`
  FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_terrainId_fkey`
  FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_secondaryClientId_fkey`
  FOREIGN KEY (`secondaryClientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Convention` ADD CONSTRAINT `Convention_agentId_fkey`
  FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- FK depuis les autres tables vers Convention
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SaleInstallment` ADD CONSTRAINT `SaleInstallment_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Document` ADD CONSTRAINT `Document_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 8. Mise à jour des valeurs d'enum ArchiveEntityType ──────────────
UPDATE `ArchiveRecord` SET `entityType` = 'CONVENTION' WHERE `entityType` = 'CONTRACT';
ALTER TABLE `ArchiveRecord`
  MODIFY COLUMN `entityType` ENUM('CLIENT','PROSPECT','OWNER','PROPERTY','CONVENTION','INVOICE','DOCUMENT') NOT NULL;
ALTER TABLE `ArchivePolicy`
  MODIFY COLUMN `entityType` ENUM('CLIENT','PROSPECT','OWNER','PROPERTY','CONVENTION','INVOICE','DOCUMENT') NOT NULL;

-- ── 9. Mise à jour des valeurs d'enum ArchiveReason ──────────────────
UPDATE `ArchiveRecord` SET `reason` = 'CONVENTION_TERMINEE' WHERE `reason` = 'CONTRAT_TERMINE';
ALTER TABLE `ArchiveRecord`
  MODIFY COLUMN `reason` ENUM('MANUEL','CONVENTION_TERMINEE','CLIENT_INACTIF','BIEN_VENDU','POLITIQUE_AUTOMATIQUE','DEMANDE_RGPD','AUTRE') NOT NULL DEFAULT 'MANUEL';
