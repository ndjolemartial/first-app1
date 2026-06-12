-- AddColumn: rattachement d'un document GED à une opération de trésorerie.
ALTER TABLE `Document` ADD COLUMN `treasuryOperationId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Document`
  ADD CONSTRAINT `Document_treasuryOperationId_fkey`
  FOREIGN KEY (`treasuryOperationId`) REFERENCES `TreasuryOperation`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
