/*
  Warnings:

  - Added the required column `fieldName` to the `PreCertificationQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PreCertificationQuestion" ADD COLUMN     "fieldName" TEXT NOT NULL;
