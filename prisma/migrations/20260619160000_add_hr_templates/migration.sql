-- Module RH/Paie : modèles éditables de contrats de travail et de bulletins de paie.

-- CreateTable
CREATE TABLE `ContractTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('CDI','CDD','STAGE','INTERIM','CONSULTANT','APPRENTISSAGE') NOT NULL,
  `body` LONGTEXT NOT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `ContractTemplate_uuid_key`(`uuid`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayslipTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `layout` ENUM('MODELE_1','MODELE_2','MODELE_3') NOT NULL DEFAULT 'MODELE_1',
  `headerHtml` LONGTEXT NULL,
  `footerHtml` LONGTEXT NULL,
  `accentColor` VARCHAR(191) NOT NULL DEFAULT '#1E3A5F',
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PayslipTemplate_uuid_key`(`uuid`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
