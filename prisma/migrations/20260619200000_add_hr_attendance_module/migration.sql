-- Module RH/Paie — Phase 4 : pointage / heures.

-- CreateTable
CREATE TABLE `AttendanceRecord` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('PRESENT','ABSENT','CONGE','REPOS','FERIE','MALADIE') NOT NULL DEFAULT 'PRESENT',
  `hoursWorked` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  `overtimeHours` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AttendanceRecord_uuid_key`(`uuid`),
  INDEX `AttendanceRecord_employeeId_idx`(`employeeId`),
  UNIQUE INDEX `AttendanceRecord_employeeId_date_key`(`employeeId`, `date`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
