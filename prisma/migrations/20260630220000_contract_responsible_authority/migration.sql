-- Autorité responsable d'un contrat de travail : employé signataire/responsable
-- (distinct du salarié titulaire). Optionnel.
ALTER TABLE `EmploymentContract` ADD COLUMN `responsibleAuthorityId` INTEGER NULL;
CREATE INDEX `EmploymentContract_responsibleAuthorityId_idx` ON `EmploymentContract`(`responsibleAuthorityId`);
ALTER TABLE `EmploymentContract`
  ADD CONSTRAINT `EmploymentContract_responsibleAuthorityId_fkey`
  FOREIGN KEY (`responsibleAuthorityId`) REFERENCES `Employee`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
