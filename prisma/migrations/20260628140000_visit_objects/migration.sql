-- Objets de visite : liste paramétrable pour le module Gestion des visiteurs.

CREATE TABLE `VisitObject` (
  `id`        INTEGER NOT NULL AUTO_INCREMENT,
  `label`     VARCHAR(191) NOT NULL,
  `isActive`  BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `deletedAt` DATETIME(3) NULL,

  UNIQUE INDEX `VisitObject_label_key`(`label`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Valeurs par défaut.
INSERT INTO `VisitObject` (`label`, `isActive`, `updatedAt`) VALUES
  ('Rendez-vous', true, NOW(3)),
  ('Réunion', true, NOW(3)),
  ('Entretien d''embauche', true, NOW(3)),
  ('Visite commerciale', true, NOW(3)),
  ('Livraison', true, NOW(3)),
  ('Maintenance / Intervention', true, NOW(3)),
  ('Autre', true, NOW(3));
