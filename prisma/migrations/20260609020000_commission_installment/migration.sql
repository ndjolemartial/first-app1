-- AlterTable: Commission — support des commissions sur échéances héritées.
-- conventionId devient nullable ; ajout d'un rattachement direct à une échéance
-- (SaleInstallment) pour les paiements échelonnés sans convention.
-- Invariant applicatif : au moins l'un de conventionId / installmentId est renseigné.
ALTER TABLE `Commission` MODIFY `conventionId` INTEGER NULL;
ALTER TABLE `Commission` ADD COLUMN `installmentId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Commission_installmentId_idx` ON `Commission`(`installmentId`);

-- AddForeignKey
ALTER TABLE `Commission` ADD CONSTRAINT `Commission_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `SaleInstallment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
