-- AddColumn: rattachement d'une activité CRM à un document GED (archive).
ALTER TABLE `CrmActivity` ADD COLUMN `documentId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `CrmActivity`
  ADD CONSTRAINT `CrmActivity_documentId_fkey`
  FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
