-- ── CRMACTIVITY — rattachement à une facture et à une échéance ─
ALTER TABLE `CrmActivity`
  ADD COLUMN `invoiceId` INTEGER NULL,
  ADD COLUMN `installmentId` INTEGER NULL;

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_installmentId_fkey`
  FOREIGN KEY (`installmentId`) REFERENCES `SaleInstallment`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
