/*
  Warnings:

  - You are about to drop the column `userId` on the `PreCertificationFormSubmission` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userCourseId]` on the table `PreCertificationFormSubmission` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userCourseId` to the `PreCertificationFormSubmission` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PreCertificationFormSubmission" DROP CONSTRAINT "PreCertificationFormSubmission_userId_fkey";

-- AlterTable
ALTER TABLE "PreCertificationFormSubmission" DROP COLUMN "userId",
ADD COLUMN     "userCourseId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PreCertificationFormSubmission_userCourseId_key" ON "PreCertificationFormSubmission"("userCourseId");

-- AddForeignKey
ALTER TABLE "PreCertificationFormSubmission" ADD CONSTRAINT "PreCertificationFormSubmission_userCourseId_fkey" FOREIGN KEY ("userCourseId") REFERENCES "UserCourses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
