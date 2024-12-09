-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "emailFromDomain" TEXT NOT NULL DEFAULT 'plumblearning.com',
ADD COLUMN     "emailFromName" TEXT NOT NULL DEFAULT 'Plumb Media & Education';
