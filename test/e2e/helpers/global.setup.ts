import { test as setup } from "@playwright/test";

import { db } from "~/integrations/db.server";

import { getE2EUserId } from "./auth";

setup("setup database", async () => {
  console.log("Setting up database...");
  const [userId, course] = await Promise.all([getE2EUserId(), db.course.findFirst()]);
  if (!course) {
    throw new Error("No course found in database. Cannot setup database.");
  }
  console.log(`Enrolling user ${userId} into course ${course.id}`);
  await db.userCourse.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id },
    update: {},
  });
});
