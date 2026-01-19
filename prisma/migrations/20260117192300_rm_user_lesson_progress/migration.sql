-- DropForeignKey
ALTER TABLE "UserLessonProgress" DROP CONSTRAINT "UserLessonProgress_userId_fkey";

-- Backfill userId with clerkId from User
UPDATE "UserLessonProgress"
SET "userId" = "User"."clerkId"
FROM "User"
WHERE "UserLessonProgress"."userId" = "User"."id";
