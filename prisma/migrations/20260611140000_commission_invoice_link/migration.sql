-- AlterTable : rattachement d'une commission à une facture encaissée.
-- L'assiette de la commission suit le montant réellement encaissé sur cette
-- facture (ventes comptant). Pour les ventes par échéances, le rattachement
-- se fait via installmentId (déjà présent).
ALTER TABLE `Commission` ADD COLUMN `invoiceId` INTEGER NULL;

-- Index sur la nouvelle clé étrangère.
CREATE INDEX `Commission_invoiceId_idx` ON `Commission`(`invoiceId`);

-- Contrainte de clé étrangère vers Invoice.
ALTER TABLE `Commission`
  ADD CONSTRAINT `Commission_invoiceId_fkey`
  FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
