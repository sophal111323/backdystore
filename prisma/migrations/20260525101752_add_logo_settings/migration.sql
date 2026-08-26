/*
  Warnings:

  - Added the required column `expiresAt` to the `UsedTotpToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "logoTagline" TEXT,
ADD COLUMN     "logoText" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ALTER COLUMN "siteName" SET DEFAULT 'JASMIN TOPUP',
ALTER COLUMN "supportTelegram" DROP DEFAULT,
ALTER COLUMN "supportEmail" DROP DEFAULT,
ALTER COLUMN "announcementTone" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UsedTotpToken" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;
