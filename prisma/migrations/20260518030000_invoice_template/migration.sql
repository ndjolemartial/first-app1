-- CreateTable : modèles de facture éditables (3 designs au choix)
CREATE TABLE `InvoiceTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `layout` ENUM('CLASSIQUE', 'MODERNE', 'COMPACT') NOT NULL DEFAULT 'CLASSIQUE',
  `headerHtml` LONGTEXT NULL,
  `footerHtml` LONGTEXT NULL,
  `accentColor` VARCHAR(191) NOT NULL DEFAULT '#1E3A5F',
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `InvoiceTemplate_uuid_key`(`uuid`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
