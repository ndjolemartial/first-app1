-- Contrats signés (fichiers téléversés) rattachés à un employé.
CREATE TABLE `EmployeeSignedContract` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `employeeId` INTEGER NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `path` VARCHAR(191) NOT NULL,
  `size` INTEGER NOT NULL,
  `uploadedById` INTEGER NULL,
  `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  INDEX `EmployeeSignedContract_employeeId_idx`(`employeeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmployeeSignedContract`
  ADD CONSTRAINT `EmployeeSignedContract_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
