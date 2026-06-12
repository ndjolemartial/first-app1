-- ════════════════════════════════════════════════════════════════════
-- Migration : catalogue de prestations / produits (CatalogItem)
-- ════════════════════════════════════════════════════════════════════
-- Articles prédéfinis (désignation + prix) réutilisables pour pré-remplir les
-- lignes de devis et de factures. Référentiel autonome, soft delete.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE `CatalogItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `type` ENUM('PRESTATION', 'PRODUIT') NOT NULL DEFAULT 'PRESTATION',
    `designation` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `unitPrice` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CatalogItem_uuid_key`(`uuid`),
    INDEX `CatalogItem_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
