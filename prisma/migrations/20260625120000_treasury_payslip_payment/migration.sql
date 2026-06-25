-- Paiement de salaire : rattachement d'une opération de trésorerie à un bulletin.

-- Nouvelle origine d'opération : paiement d'un bulletin de salaire.
ALTER TABLE `TreasuryOperation`
  MODIFY COLUMN `source` ENUM('MANUEL', 'FACTURE', 'ECHEANCE', 'COMMISSION', 'PAIE') NOT NULL DEFAULT 'MANUEL';

-- Lien vers le bulletin de salaire réglé (source PAIE).
ALTER TABLE `TreasuryOperation` ADD COLUMN `payslipId` INTEGER NULL;

CREATE INDEX `TreasuryOperation_payslipId_idx` ON `TreasuryOperation`(`payslipId`);

ALTER TABLE `TreasuryOperation` ADD CONSTRAINT `TreasuryOperation_payslipId_fkey`
  FOREIGN KEY (`payslipId`) REFERENCES `Payslip`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
