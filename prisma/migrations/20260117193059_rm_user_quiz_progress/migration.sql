-- DropForeignKey
ALTER TABLE "UserQuizProgress" DROP CONSTRAINT "UserQuizProgress_userId_fkey";

-- Backfill userId with clerkId from User
UPDATE "UserQuizProgress"
SET "userId" = "User"."clerkId"
FROM "User"
WHERE "UserQuizProgress"."userId" = "User"."id";
