-- AlterTable: SaleInstallment — support des échéances héritées sans convention.
-- L'ancienne application gérait des paiements échelonnés sur terrain sans
-- convention signée, liés directement au client. On rend `conventionId`
-- nullable et on ajoute des liens directs vers le client et le terrain.
-- Invariant applicatif : au moins l'un de conventionId / clientId est renseigné.
ALTER TABLE `SaleInstallment` MODIFY `conventionId` INTEGER NULL;
ALTER TABLE `SaleInstallment` ADD COLUMN `clientId` INTEGER NULL;
ALTER TABLE `SaleInstallment` ADD COLUMN `terrainId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `SaleInstallment_clientId_idx` ON `SaleInstallment`(`clientId`);
CREATE INDEX `SaleInstallment_terrainId_idx` ON `SaleInstallment`(`terrainId`);

-- AddForeignKey
ALTER TABLE `SaleInstallment` ADD CONSTRAINT `SaleInstallment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SaleInstallment` ADD CONSTRAINT `SaleInstallment_terrainId_fkey` FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
