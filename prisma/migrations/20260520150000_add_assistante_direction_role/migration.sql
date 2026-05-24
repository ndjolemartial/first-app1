-- AlterEnum : ajout du rôle ASSISTANTE_DIRECTION (hérite des droits du comptable).
ALTER TABLE `User` MODIFY COLUMN `role` ENUM(
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'ASSISTANTE_DIRECTION',
  'AGENT',
  'READONLY'
) NOT NULL DEFAULT 'AGENT';
