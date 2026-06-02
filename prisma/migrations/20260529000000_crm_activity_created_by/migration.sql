-- ── CrmActivity — traçabilité du créateur ─────────────────────
-- Ajoute un champ `createdById` pour identifier l'utilisateur qui a
-- créé l'activité (distinct de `userId` qui correspond à l'assigné).
-- Utilisé pour la visibilité fine : un rôle restreint (AGENT, READONLY,
-- ASSISTANTE_DIRECTION) ne voit que les activités qu'il a créées ou
-- qui lui sont assignées. Les rôles à vision complète (SUPER_ADMIN,
-- ADMIN, MANAGER, ACCOUNTANT) voient toutes les activités.
ALTER TABLE `CrmActivity` ADD COLUMN `createdById` INTEGER NULL;

CREATE INDEX `CrmActivity_createdById_idx` ON `CrmActivity`(`createdById`);

ALTER TABLE `CrmActivity` ADD CONSTRAINT `CrmActivity_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
