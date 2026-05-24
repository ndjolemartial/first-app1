-- ── TREASURY OPERATION — rattachement analytique optionnel ─────
-- Une opération peut être imputée à AU PLUS un projet, ou un lotissement,
-- ou un programme immobilier. L'exclusivité est appliquée côté application
-- (validation Zod dans treasury.ipc.ts).
ALTER TABLE `TreasuryOperation`
  ADD COLUMN `projectId`     INTEGER NULL,
  ADD COLUMN `lotissementId` INTEGER NULL,
  ADD COLUMN `programmeId`   INTEGER NULL;

CREATE INDEX `TreasuryOperation_projectId_idx`     ON `TreasuryOperation`(`projectId`);
CREATE INDEX `TreasuryOperation_lotissementId_idx` ON `TreasuryOperation`(`lotissementId`);
CREATE INDEX `TreasuryOperation_programmeId_idx`   ON `TreasuryOperation`(`programmeId`);

ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_projectId_fkey`
  FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_lotissementId_fkey`
  FOREIGN KEY (`lotissementId`) REFERENCES `Lotissement`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_programmeId_fkey`
  FOREIGN KEY (`programmeId`) REFERENCES `ProgrammeImmobilier`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
