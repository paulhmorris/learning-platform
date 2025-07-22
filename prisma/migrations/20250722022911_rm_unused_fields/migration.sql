/*
  Warnings:

  - You are about to drop the column `emailFromDomain` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `emailFromName` on the `Course` table. All the data in the column will be lost.
  - You are about to drop the column `isIdentityVerified` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Course" DROP COLUMN "emailFromDomain",
DROP COLUMN "emailFromName";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isIdentityVerified";

-- CreateIndex
CREATE INDEX "Course_strapiId_idx" ON "Course"("strapiId");

-- CreateIndex
CREATE INDEX "User_clerkId_idx" ON "User"("clerkId");
