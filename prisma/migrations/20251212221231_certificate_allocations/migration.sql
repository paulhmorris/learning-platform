/*
  Warnings:

  - You are about to drop the column `certificateNumber` on the `UserCourses` table. All the data in the column will be lost.
  - You are about to drop the column `certificateS3Key` on the `UserCourses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "issuesCertificate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserCourses" DROP COLUMN "certificateNumber",
DROP COLUMN "certificateS3Key";

-- CreateTable
CREATE TABLE "Certificate" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "s3Key" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userCourseId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateNumberAllocation" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateNumberAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_number_key" ON "Certificate"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userCourseId_key" ON "Certificate"("userCourseId");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- CreateIndex
CREATE INDEX "Certificate_userCourseId_idx" ON "Certificate"("userCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateNumberAllocation_number_key" ON "CertificateNumberAllocation"("number");

-- CreateIndex
CREATE INDEX "CertificateNumberAllocation_courseId_idx" ON "CertificateNumberAllocation"("courseId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userCourseId_fkey" FOREIGN KEY ("userCourseId") REFERENCES "UserCourses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateNumberAllocation" ADD CONSTRAINT "CertificateNumberAllocation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
