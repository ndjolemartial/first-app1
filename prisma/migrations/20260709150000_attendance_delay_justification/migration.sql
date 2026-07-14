-- Retards & Départs précipités : justification d'une journée de retard
-- d'arrivée / départ anticipé, liée à un congé approuvé ou à une activité CRM
-- « Visite chantier / Sortie en clientèle / Courses » traitée.

CREATE TABLE `AttendanceDelayJustification` (
  `id`             INTEGER NOT NULL AUTO_INCREMENT,
  `employeeId`     INTEGER NOT NULL,
  `date`           DATE NOT NULL,
  `leaveRequestId` INTEGER NULL,
  `crmActivityId`  INTEGER NULL,
  `justified`      BOOLEAN NOT NULL DEFAULT false,
  `justifiedById`  INTEGER NULL,
  `justifiedAt`    DATETIME(3) NULL,
  `notes`          TEXT NULL,
  `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3) NOT NULL,

  UNIQUE INDEX `AttendanceDelayJustification_crmActivityId_key`(`crmActivityId`),
  UNIQUE INDEX `AttendanceDelayJustification_employeeId_date_key`(`employeeId`, `date`),
  INDEX `AttendanceDelayJustification_employeeId_idx`(`employeeId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AttendanceDelayJustification` ADD CONSTRAINT `AttendanceDelayJustification_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AttendanceDelayJustification` ADD CONSTRAINT `AttendanceDelayJustification_leaveRequestId_fkey`
  FOREIGN KEY (`leaveRequestId`) REFERENCES `LeaveRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AttendanceDelayJustification` ADD CONSTRAINT `AttendanceDelayJustification_crmActivityId_fkey`
  FOREIGN KEY (`crmActivityId`) REFERENCES `CrmActivity`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AttendanceDelayJustification` ADD CONSTRAINT `AttendanceDelayJustification_justifiedById_fkey`
  FOREIGN KEY (`justifiedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
