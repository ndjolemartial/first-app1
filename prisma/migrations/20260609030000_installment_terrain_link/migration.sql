-- CreateTable: liaison Échéance héritée ↔ Terrain(s).
-- Une échéance héritée (sans convention) peut concerner un ou plusieurs terrains ;
-- l'assiette des frais de démarches ACD est la somme des frais ACD des terrains
-- rattachés.
CREATE TABLE `SaleInstallmentTerrain` (
    `installmentId` INTEGER NOT NULL,
    `terrainId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SaleInstallmentTerrain_terrainId_idx`(`terrainId`),
    PRIMARY KEY (`installmentId`, `terrainId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SaleInstallmentTerrain` ADD CONSTRAINT `SaleInstallmentTerrain_installmentId_fkey` FOREIGN KEY (`installmentId`) REFERENCES `SaleInstallment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SaleInstallmentTerrain` ADD CONSTRAINT `SaleInstallmentTerrain_terrainId_fkey` FOREIGN KEY (`terrainId`) REFERENCES `Terrain`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
