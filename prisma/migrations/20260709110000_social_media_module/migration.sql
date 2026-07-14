-- Module 15 — Réseaux Sociaux & Plateformes Web : suivi manuel des comptes
-- réseaux sociaux et du site web (publications/articles, abonnés, vues,
-- interactions).

CREATE TABLE `SocialPlatform` (
  `id`            INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`          VARCHAR(191) NOT NULL,
  `name`          VARCHAR(191) NOT NULL,
  `type`          ENUM('FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TIKTOK', 'X_TWITTER', 'YOUTUBE', 'WEBSITE', 'AUTRE') NOT NULL,
  `url`           VARCHAR(191) NULL,
  `responsibleId` INTEGER NULL,
  `isActive`      BOOLEAN NOT NULL DEFAULT true,
  `notes`         TEXT NULL,
  `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`     DATETIME(3) NOT NULL,
  `deletedAt`     DATETIME(3) NULL,

  UNIQUE INDEX `SocialPlatform_uuid_key`(`uuid`),
  INDEX `SocialPlatform_responsibleId_idx`(`responsibleId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SocialPublication` (
  `id`                INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`              VARCHAR(191) NOT NULL,
  `platformId`        INTEGER NOT NULL,
  `type`              ENUM('PUBLICATION', 'ARTICLE') NOT NULL DEFAULT 'PUBLICATION',
  `title`             VARCHAR(191) NOT NULL,
  `publishedAt`       DATETIME(3) NOT NULL,
  `url`               VARCHAR(191) NULL,
  `viewsCount`        INTEGER NOT NULL DEFAULT 0,
  `interactionsCount` INTEGER NOT NULL DEFAULT 0,
  `authorId`          INTEGER NULL,
  `notes`             TEXT NULL,
  `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`         DATETIME(3) NOT NULL,
  `deletedAt`         DATETIME(3) NULL,

  UNIQUE INDEX `SocialPublication_uuid_key`(`uuid`),
  INDEX `SocialPublication_platformId_idx`(`platformId`),
  INDEX `SocialPublication_authorId_idx`(`authorId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SocialFollowerSnapshot` (
  `id`             INTEGER NOT NULL AUTO_INCREMENT,
  `platformId`     INTEGER NOT NULL,
  `date`           DATETIME(3) NOT NULL,
  `followersCount` INTEGER NOT NULL,
  `recordedById`   INTEGER NULL,
  `notes`          VARCHAR(191) NULL,
  `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `SocialFollowerSnapshot_platformId_date_key`(`platformId`, `date`),
  INDEX `SocialFollowerSnapshot_recordedById_idx`(`recordedById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SocialPlatform` ADD CONSTRAINT `SocialPlatform_responsibleId_fkey`
  FOREIGN KEY (`responsibleId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SocialPublication` ADD CONSTRAINT `SocialPublication_platformId_fkey`
  FOREIGN KEY (`platformId`) REFERENCES `SocialPlatform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SocialPublication` ADD CONSTRAINT `SocialPublication_authorId_fkey`
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `SocialFollowerSnapshot` ADD CONSTRAINT `SocialFollowerSnapshot_platformId_fkey`
  FOREIGN KEY (`platformId`) REFERENCES `SocialPlatform`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SocialFollowerSnapshot` ADD CONSTRAINT `SocialFollowerSnapshot_recordedById_fkey`
  FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
