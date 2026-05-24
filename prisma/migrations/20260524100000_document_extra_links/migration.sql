-- ── DOCUMENT — rattachements complémentaires ──────────────────
-- Un document de la GED peut désormais être lié à un prospect, un apporteur
-- d'affaires, un utilisateur (distinct de l'uploader), une facture, une
-- commission ou une attestation. Toutes les FK sont nullables (1 lien max
-- par type, pattern identique aux rattachements existants).
ALTER TABLE `Document`
  ADD COLUMN `prospectId`    INTEGER NULL,
  ADD COLUMN `referrerId`    INTEGER NULL,
  ADD COLUMN `linkedUserId`  INTEGER NULL,
  ADD COLUMN `invoiceId`     INTEGER NULL,
  ADD COLUMN `commissionId`  INTEGER NULL,
  ADD COLUMN `attestationId` INTEGER NULL;

CREATE INDEX `Document_prospectId_idx`    ON `Document`(`prospectId`);
CREATE INDEX `Document_referrerId_idx`    ON `Document`(`referrerId`);
CREATE INDEX `Document_linkedUserId_idx`  ON `Document`(`linkedUserId`);
CREATE INDEX `Document_invoiceId_idx`     ON `Document`(`invoiceId`);
CREATE INDEX `Document_commissionId_idx`  ON `Document`(`commissionId`);
CREATE INDEX `Document_attestationId_idx` ON `Document`(`attestationId`);

ALTER TABLE `Document` ADD CONSTRAINT `Document_prospectId_fkey`
  FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Document` ADD CONSTRAINT `Document_referrerId_fkey`
  FOREIGN KEY (`referrerId`) REFERENCES `BusinessReferrer`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Document` ADD CONSTRAINT `Document_linkedUserId_fkey`
  FOREIGN KEY (`linkedUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Document` ADD CONSTRAINT `Document_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Document` ADD CONSTRAINT `Document_commissionId_fkey`
  FOREIGN KEY (`commissionId`) REFERENCES `Commission`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Document` ADD CONSTRAINT `Document_attestationId_fkey`
  FOREIGN KEY (`attestationId`) REFERENCES `Attestation`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
