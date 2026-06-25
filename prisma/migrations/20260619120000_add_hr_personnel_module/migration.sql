-- Module RH/Paie — Phase 1 : rôle RH, dossiers du personnel et contrats de travail.

-- Ajout du rôle RH à l'énumération des rôles utilisateur.
ALTER TABLE `User`
  MODIFY `role` ENUM('SUPER_ADMIN','ADMIN','MANAGER','ACCOUNTANT','ASSISTANTE_DIRECTION','AGENT','AGENT_TECHNIQUE','RH','READONLY') NOT NULL DEFAULT 'AGENT';

-- CreateTable
CREATE TABLE `Employee` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `matricule` VARCHAR(191) NOT NULL,
  `civilite` ENUM('MONSIEUR','MADAME','MADEMOISELLE') NULL,
  `firstName` VARCHAR(191) NOT NULL,
  `lastName` VARCHAR(191) NOT NULL,
  `sexe` ENUM('MASCULIN','FEMININ') NULL,
  `birthDate` DATETIME(3) NULL,
  `birthPlace` VARCHAR(191) NULL,
  `nationality` VARCHAR(191) NULL DEFAULT 'CI',
  `maritalStatus` ENUM('CELIBATAIRE','MARIEE','CONCUBINAGE','DIVORCE','VEUF') NULL,
  `childrenCount` INTEGER NOT NULL DEFAULT 0,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `mobile` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `idNumber` VARCHAR(191) NULL,
  `cnpsNumber` VARCHAR(191) NULL,
  `cmuNumber` VARCHAR(191) NULL,
  `bankName` VARCHAR(191) NULL,
  `bankRib` VARCHAR(191) NULL,
  `poste` VARCHAR(191) NULL,
  `departement` VARCHAR(191) NULL,
  `userId` INTEGER NULL,
  `status` ENUM('ACTIF','SUSPENDU','CONGE','SORTI') NOT NULL DEFAULT 'ACTIF',
  `hireDate` DATETIME(3) NULL,
  `exitDate` DATETIME(3) NULL,
  `exitReason` VARCHAR(191) NULL,
  `photo` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `Employee_uuid_key`(`uuid`),
  UNIQUE INDEX `Employee_matricule_key`(`matricule`),
  UNIQUE INDEX `Employee_userId_key`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmploymentContract` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `type` ENUM('CDI','CDD','STAGE','INTERIM','CONSULTANT','APPRENTISSAGE') NOT NULL DEFAULT 'CDI',
  `status` ENUM('BROUILLON','ACTIF','SUSPENDU','TERMINE','ROMPU') NOT NULL DEFAULT 'ACTIF',
  `poste` VARCHAR(191) NULL,
  `categorie` VARCHAR(191) NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NULL,
  `trialEndDate` DATETIME(3) NULL,
  `weeklyHours` DECIMAL(5, 2) NULL,
  `baseSalary` DECIMAL(15, 2) NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `EmploymentContract_uuid_key`(`uuid`),
  UNIQUE INDEX `EmploymentContract_reference_key`(`reference`),
  INDEX `EmploymentContract_employeeId_idx`(`employeeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmploymentContract` ADD CONSTRAINT `EmploymentContract_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
