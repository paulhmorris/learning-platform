-- DropForeignKey
ALTER TABLE "UserCourses" DROP CONSTRAINT "UserCourses_userId_fkey";

-- Backfill userId with clerkId from User
UPDATE "UserCourses"
SET "userId" = "User"."clerkId"
FROM "User"
WHERE "UserCourses"."userId" = "User"."id";
