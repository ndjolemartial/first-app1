-- ════════════════════════════════════════════════════════════════════
-- Migration : Fiche de suivi chronologique — journal des statuts/modifications
-- ════════════════════════════════════════════════════════════════════
--  Objectif :
--   - Ajouter un journal générique (entityType/entityId, comme `Note`) qui
--     enregistre, à partir de sa mise en place, les changements de statut et
--     les modifications de fiche pour les entités Client et Prospect. Aucune
--     donnée rétroactive (pas d'historique avant ce jour).
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE `EntityTimelineEvent` (
  `id`          INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`        VARCHAR(191) NOT NULL,
  `entityType`  VARCHAR(191) NOT NULL,
  `entityId`    INTEGER NOT NULL,
  `eventType`   ENUM('STATUS_CHANGE', 'MODIFICATION') NOT NULL,
  `description` TEXT NOT NULL,
  `oldValue`    VARCHAR(191) NULL,
  `newValue`    VARCHAR(191) NULL,
  `userId`      INTEGER NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `EntityTimelineEvent_uuid_key`(`uuid`),
  INDEX `EntityTimelineEvent_entityType_entityId_idx`(`entityType`, `entityId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EntityTimelineEvent` ADD CONSTRAINT `EntityTimelineEvent_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
