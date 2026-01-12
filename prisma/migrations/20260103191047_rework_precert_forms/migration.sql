/*
  Warnings:

  - You are about to drop the `PreCertificationAnswer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PreCertificationQuestion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PreCertificationAnswer" DROP CONSTRAINT "PreCertificationAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "PreCertificationAnswer" DROP CONSTRAINT "PreCertificationAnswer_userId_fkey";

-- DropForeignKey
ALTER TABLE "PreCertificationQuestion" DROP CONSTRAINT "PreCertificationQuestion_courseId_fkey";

-- DropTable
DROP TABLE "PreCertificationAnswer";

-- DropTable
DROP TABLE "PreCertificationQuestion";

-- CreateTable
CREATE TABLE "PreCertificationFormSubmission" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "formData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreCertificationFormSubmission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PreCertificationFormSubmission" ADD CONSTRAINT "PreCertificationFormSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
