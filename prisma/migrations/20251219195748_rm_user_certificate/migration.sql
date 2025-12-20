/*
  Warnings:

  - You are about to drop the column `userId` on the `Certificate` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_userId_fkey";

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "userId";
