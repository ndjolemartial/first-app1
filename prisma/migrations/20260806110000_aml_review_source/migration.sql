-- AlterTable
ALTER TABLE `AmlTransactionReview` DROP COLUMN `conventionReference`,
    ADD COLUMN `sourceId` INTEGER NULL,
    ADD COLUMN `sourceLabel` VARCHAR(191) NULL,
    ADD COLUMN `sourceType` VARCHAR(191) NULL,
    MODIFY `conventionId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `AmlTransactionReview_sourceType_sourceId_idx` ON `AmlTransactionReview`(`sourceType`, `sourceId`);
