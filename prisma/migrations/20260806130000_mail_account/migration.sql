-- AlterTable
ALTER TABLE `Communication` ADD COLUMN `inReplyToMessageId` VARCHAR(191) NULL,
    ADD COLUMN `mailAccountId` INTEGER NULL,
    ADD COLUMN `messageId` VARCHAR(191) NULL,
    ADD COLUMN `parentCommunicationId` INTEGER NULL;

-- CreateTable
CREATE TABLE `MailAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `label` VARCHAR(191) NULL,
    `imapHost` VARCHAR(191) NOT NULL,
    `imapPort` INTEGER NOT NULL DEFAULT 993,
    `imapSecure` BOOLEAN NOT NULL DEFAULT true,
    `imapUser` VARCHAR(191) NOT NULL,
    `imapPasswordEnc` TEXT NOT NULL,
    `folder` VARCHAR(191) NOT NULL DEFAULT 'INBOX',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastUid` INTEGER NULL,
    `lastPolledAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MailAccount_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Communication_messageId_idx` ON `Communication`(`messageId`);

-- CreateIndex
CREATE INDEX `Communication_parentCommunicationId_idx` ON `Communication`(`parentCommunicationId`);

-- CreateIndex
CREATE UNIQUE INDEX `Communication_mailAccountId_messageId_key` ON `Communication`(`mailAccountId`, `messageId`);

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_parentCommunicationId_fkey` FOREIGN KEY (`parentCommunicationId`) REFERENCES `Communication`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Communication` ADD CONSTRAINT `Communication_mailAccountId_fkey` FOREIGN KEY (`mailAccountId`) REFERENCES `MailAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MailAccount` ADD CONSTRAINT `MailAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
