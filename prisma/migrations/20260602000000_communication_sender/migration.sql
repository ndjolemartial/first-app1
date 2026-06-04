-- ── Communication — expéditeur (utilisateur ayant déclenché l'envoi) ──────────
-- Permet de filtrer l'historique selon le rôle : les comptes non privilégiés
-- (hors SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT) ne voient que leurs propres
-- envois ou les messages adressés à un client qui leur est rattaché.
-- Les envois automatiques (politique de relances) restent à NULL.
ALTER TABLE `Communication` ADD COLUMN `senderId` INTEGER NULL;

CREATE INDEX `Communication_senderId_idx` ON `Communication`(`senderId`);

ALTER TABLE `Communication` ADD CONSTRAINT `Communication_senderId_fkey`
  FOREIGN KEY (`senderId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
