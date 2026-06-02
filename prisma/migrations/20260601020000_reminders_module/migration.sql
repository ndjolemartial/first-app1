-- Module Politique de relance — ReminderRule + extensions Communication / Client.
--
-- Ajoute :
--   1. La table `ReminderRule` : une règle de relance par cas d'usage (échéance à venir / en retard
--      / convention qui expire), canal (EMAIL/SMS), offset en jours et template associé.
--   2. Sur `Communication` : `dedupeKey` (anti-doublon par cas d'usage + entité + fenêtre) et
--      `clientId` (rattachement direct au client pour la traçabilité par fiche).
--   3. Sur `Client` : `smsOptOut` / `emailOptOut` (refus de relances par canal).

-- ── ReminderRule ─────────────────────────────────────────────────────────────
CREATE TABLE `ReminderRule` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(64) NOT NULL,
  `name`         VARCHAR(191) NOT NULL,
  `description`  TEXT NULL,
  `triggerType`  ENUM('INSTALLMENT_UPCOMING','INSTALLMENT_OVERDUE','CONVENTION_EXPIRING') NOT NULL,
  `offsetDays`   INT NOT NULL,
  `channel`      ENUM('EMAIL','SMS') NOT NULL,
  `templateId`   INT NULL,
  `isActive`     BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3) NOT NULL,

  UNIQUE INDEX `ReminderRule_code_key`(`code`),
  INDEX `ReminderRule_templateId_idx`(`templateId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReminderRule`
  ADD CONSTRAINT `ReminderRule_templateId_fkey`
  FOREIGN KEY (`templateId`) REFERENCES `CommTemplate`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Communication : dedupeKey + clientId ─────────────────────────────────────
ALTER TABLE `Communication`
  ADD COLUMN `dedupeKey` VARCHAR(191) NULL,
  ADD COLUMN `clientId`  INT NULL,
  ADD UNIQUE INDEX `Communication_dedupeKey_key`(`dedupeKey`),
  ADD INDEX `Communication_clientId_idx`(`clientId`);

ALTER TABLE `Communication`
  ADD CONSTRAINT `Communication_clientId_fkey`
  FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Client : opt-out par canal ───────────────────────────────────────────────
ALTER TABLE `Client`
  ADD COLUMN `smsOptOut`   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN `emailOptOut` BOOLEAN NOT NULL DEFAULT FALSE;
