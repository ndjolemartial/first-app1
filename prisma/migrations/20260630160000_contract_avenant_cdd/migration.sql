-- Type de contrat « AVENANT_CDD » (avenant de prolongation rattaché à un CDD)
-- + rattachement au contrat CDD initial (self-relation).
ALTER TABLE `EmploymentContract`
  MODIFY `type` ENUM('CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI', 'AVENANT_CDD') NOT NULL DEFAULT 'CDI';
ALTER TABLE `ContractTemplate`
  MODIFY `type` ENUM('CDI', 'CDD', 'STAGE', 'INTERIM', 'CONSULTANT', 'APPRENTISSAGE', 'ESSAI', 'AVENANT_CDD') NOT NULL;

ALTER TABLE `EmploymentContract` ADD COLUMN `parentContractId` INTEGER NULL;
CREATE INDEX `EmploymentContract_parentContractId_idx` ON `EmploymentContract`(`parentContractId`);
ALTER TABLE `EmploymentContract`
  ADD CONSTRAINT `EmploymentContract_parentContractId_fkey`
  FOREIGN KEY (`parentContractId`) REFERENCES `EmploymentContract`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
