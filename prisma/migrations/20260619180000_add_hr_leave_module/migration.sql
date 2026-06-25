-- Module RH/Paie — Phase 3 : congés & absences.

-- CreateTable
CREATE TABLE `LeaveType` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `isPaid` BOOLEAN NOT NULL DEFAULT true,
  `affectsBalance` BOOLEAN NOT NULL DEFAULT false,
  `color` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `LeaveType_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `typeId` INTEGER NOT NULL,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NOT NULL,
  `days` DECIMAL(5, 1) NOT NULL,
  `reason` TEXT NULL,
  `status` ENUM('EN_ATTENTE','APPROUVE','REFUSE','ANNULE') NOT NULL DEFAULT 'EN_ATTENTE',
  `decidedById` INTEGER NULL,
  `decidedAt` DATETIME(3) NULL,
  `decisionNote` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `LeaveRequest_uuid_key`(`uuid`),
  UNIQUE INDEX `LeaveRequest_reference_key`(`reference`),
  INDEX `LeaveRequest_employeeId_idx`(`employeeId`),
  INDEX `LeaveRequest_typeId_idx`(`typeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `LeaveType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
