-- Module Gestion des appels (entrants / sortants).

CREATE TABLE `PhoneCall` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`        VARCHAR(191) NOT NULL,
  `direction`   ENUM('ENTRANT', 'SORTANT') NOT NULL,
  `firstName`   VARCHAR(191) NULL,
  `lastName`    VARCHAR(191) NULL,
  `company`     VARCHAR(191) NULL,
  `phone`       VARCHAR(191) NOT NULL,
  `email`       VARCHAR(191) NULL,
  `objet`       VARCHAR(191) NOT NULL,
  `details`     TEXT NULL,
  `duration`    INTEGER NULL,
  `status`      ENUM('ABOUTI', 'MANQUE', 'OCCUPE', 'MESSAGE_LAISSE') NOT NULL DEFAULT 'ABOUTI',
  `calledAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `clientId`    INTEGER NULL,
  `prospectId`  INTEGER NULL,
  `createdById` INTEGER NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,
  `deletedAt`   DATETIME(3) NULL,

  UNIQUE INDEX `PhoneCall_uuid_key`(`uuid`),
  INDEX `PhoneCall_calledAt_idx`(`calledAt`),
  INDEX `PhoneCall_clientId_idx`(`clientId`),
  INDEX `PhoneCall_prospectId_idx`(`prospectId`),
  INDEX `PhoneCall_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PhoneCall` ADD CONSTRAINT `PhoneCall_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PhoneCall` ADD CONSTRAINT `PhoneCall_prospectId_fkey`
  FOREIGN KEY (`prospectId`) REFERENCES `Prospect`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `PhoneCall` ADD CONSTRAINT `PhoneCall_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
