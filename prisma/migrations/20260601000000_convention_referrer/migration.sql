-- ── Convention — apporteur d'affaires ─────────────────────────
-- Ajoute un champ `referrerId` pour lier la convention à un
-- BusinessReferrer (apporteur d'affaire). Symétrique du champ
-- `agentId` (utilisateur référent interne) déjà présent. Les deux
-- coexistent : une convention peut être suivie par un utilisateur
-- interne ET apportée par un référent externe.
ALTER TABLE `Convention` ADD COLUMN `referrerId` INTEGER NULL;

CREATE INDEX `Convention_referrerId_idx` ON `Convention`(`referrerId`);

ALTER TABLE `Convention` ADD CONSTRAINT `Convention_referrerId_fkey`
  FOREIGN KEY (`referrerId`) REFERENCES `BusinessReferrer`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
