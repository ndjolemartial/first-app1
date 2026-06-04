-- ── Canal WhatsApp + cibles \xE9tendues sur Communication ─────────────────────
-- 1. Ajout de la valeur WHATSAPP \xE0 l'enum CommChannel (utilis\xE9e par
--    Communication.channel, CommTemplate.channel et ReminderRule.channel).
-- 2. Ajout des FK ownerId et conventionId sur Communication pour permettre
--    l'envoi cibl\xE9 \xE0 un Propri\xE9taire ou \xE0 une Convention depuis l'interface
--    Communication — et conserver la tra\xE7abilit\xE9 du rattachement.

ALTER TABLE `Communication` MODIFY `channel` ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL;
ALTER TABLE `CommTemplate`  MODIFY `channel` ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL;
ALTER TABLE `ReminderRule`  MODIFY `channel` ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL;

ALTER TABLE `Communication` ADD COLUMN `ownerId` INTEGER NULL;
ALTER TABLE `Communication` ADD COLUMN `conventionId` INTEGER NULL;

CREATE INDEX `Communication_ownerId_idx`      ON `Communication`(`ownerId`);
CREATE INDEX `Communication_conventionId_idx` ON `Communication`(`conventionId`);

ALTER TABLE `Communication` ADD CONSTRAINT `Communication_ownerId_fkey`
  FOREIGN KEY (`ownerId`) REFERENCES `Owner`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Communication` ADD CONSTRAINT `Communication_conventionId_fkey`
  FOREIGN KEY (`conventionId`) REFERENCES `Convention`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
