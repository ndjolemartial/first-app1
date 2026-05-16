-- AlterTable
ALTER TABLE `Terrain`
  ADD COLUMN `numeroADU`                    VARCHAR(191) NULL AFTER `viabilise`,
  ADD COLUMN `numeroAttestationAttribution` VARCHAR(191) NULL AFTER `numeroADU`,
  ADD COLUMN `numeroAttestationCession`     VARCHAR(191) NULL AFTER `numeroAttestationAttribution`;
