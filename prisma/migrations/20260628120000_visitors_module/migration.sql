-- Module Gestion des visiteurs.

CREATE TABLE `Visitor` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`        VARCHAR(191) NOT NULL,
  `firstName`   VARCHAR(191) NOT NULL,
  `lastName`    VARCHAR(191) NOT NULL,
  `company`     VARCHAR(191) NULL,
  `phone`       VARCHAR(191) NULL,
  `email`       VARCHAR(191) NULL,
  `objet`       VARCHAR(191) NOT NULL,
  `details`     TEXT NULL,
  `visitedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `source`      ENUM('QR', 'INTERNE') NOT NULL DEFAULT 'QR',
  `createdById` INTEGER NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,
  `deletedAt`   DATETIME(3) NULL,

  UNIQUE INDEX `Visitor_uuid_key`(`uuid`),
  INDEX `Visitor_visitedAt_idx`(`visitedAt`),
  INDEX `Visitor_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Visitor` ADD CONSTRAINT `Visitor_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
