-- AlterTable
ALTER TABLE "Course" ADD COLUMN "stripePriceIds" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing single price id into the new array column
UPDATE "Course" SET "stripePriceIds" = ARRAY["stripePriceId"] WHERE "stripePriceId" IS NOT NULL AND "stripePriceId" != '';
