-- ── MODÈLE D'EXPORT DE LISTES ─────────────────────────────────
-- Modèle unique et éditable appliqué aux exports PDF / Excel des listes.

CREATE TABLE `ListExportTemplate` (
  `id`              INTEGER NOT NULL AUTO_INCREMENT,
  `uuid`            VARCHAR(191) NOT NULL,
  `name`            VARCHAR(191) NOT NULL,
  `orientation`     ENUM('PORTRAIT', 'PAYSAGE') NOT NULL DEFAULT 'PAYSAGE',
  `accentColor`     VARCHAR(191) NOT NULL DEFAULT '#1E3A5F',
  `headerHtml`      LONGTEXT NULL,
  `footerHtml`      LONGTEXT NULL,
  `showGeneratedAt` BOOLEAN NOT NULL DEFAULT true,
  `showRowCount`    BOOLEAN NOT NULL DEFAULT true,
  `isActive`        BOOLEAN NOT NULL DEFAULT true,
  `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`       DATETIME(3) NOT NULL,

  UNIQUE INDEX `ListExportTemplate_uuid_key`(`uuid`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed : modèle par défaut.
INSERT INTO `ListExportTemplate`
  (`uuid`, `name`, `orientation`, `accentColor`, `headerHtml`, `footerHtml`, `updatedAt`)
VALUES (
  UUID(),
  'Modèle par défaut',
  'PAYSAGE',
  '#1E3A5F',
  '<p><strong style="font-size:16px">AFRIKIMMO</strong> — Gestion immobilière</p>',
  '<p>Document généré par Afrikimmo-App.</p>',
  CURRENT_TIMESTAMP(3)
);
