-- Module RH/Paie — Phase 2 : bulletins de paie (calcul conforme Côte d'Ivoire).

-- CreateTable
CREATE TABLE `Payslip` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `contractId` INTEGER NULL,
  `periodYear` INTEGER NOT NULL,
  `periodMonth` INTEGER NOT NULL,
  `baseSalary` DECIMAL(15, 2) NOT NULL,
  `grossTaxable` DECIMAL(15, 2) NOT NULL,
  `totalGains` DECIMAL(15, 2) NOT NULL,
  `cnpsEmployee` DECIMAL(15, 2) NOT NULL,
  `its` DECIMAL(15, 2) NOT NULL,
  `cmuEmployee` DECIMAL(15, 2) NOT NULL,
  `otherDeductions` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `totalDeductions` DECIMAL(15, 2) NOT NULL,
  `netSalary` DECIMAL(15, 2) NOT NULL,
  `employerCharges` DECIMAL(15, 2) NOT NULL,
  `employerCost` DECIMAL(15, 2) NOT NULL,
  `status` ENUM('BROUILLON','VALIDE','PAYE','ANNULE') NOT NULL DEFAULT 'BROUILLON',
  `paidAt` DATETIME(3) NULL,
  `paymentMethod` ENUM('ESPECE','CHEQUE','TRANSFERT','VIREMENT','MOBILE_MONEY','NON_DEFINI') NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `Payslip_uuid_key`(`uuid`),
  UNIQUE INDEX `Payslip_reference_key`(`reference`),
  INDEX `Payslip_employeeId_idx`(`employeeId`),
  UNIQUE INDEX `Payslip_employeeId_periodYear_periodMonth_key`(`employeeId`, `periodYear`, `periodMonth`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayslipLine` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `payslipId` INTEGER NOT NULL,
  `type` ENUM('GAIN','RETENUE','CHARGE_PATRONALE','INFO') NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `base` DECIMAL(15, 2) NULL,
  `rate` DECIMAL(7, 4) NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `order` INTEGER NOT NULL DEFAULT 0,

  INDEX `PayslipLine_payslipId_idx`(`payslipId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `EmploymentContract`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayslipLine` ADD CONSTRAINT `PayslipLine_payslipId_fkey` FOREIGN KEY (`payslipId`) REFERENCES `Payslip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
