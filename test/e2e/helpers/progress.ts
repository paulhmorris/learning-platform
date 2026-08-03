import { db } from "~/integrations/db.server";
import { CourseService } from "~/services/course.server";
import { ProgressService } from "~/services/progress.server";
import { QuizService } from "~/services/quiz.server";

import { invalidateAllProgressCacheForUser, invalidateLessonProgressCache, invalidateQuizProgressCache } from "./cache";

export async function getCourseLayoutForE2E() {
  const course = await db.course.findFirst();
  if (!course) {
    throw new Error("No course found in database. Cannot load course layout.");
  }

  const courseLayout = await CourseService.getFromCMSForCourseLayout(course.strapiId);
  if (!courseLayout) {
    throw new Error("No course layout found in CMS.");
  }

  return courseLayout.data;
}

/**
 * Points the course under test at the current base URL's host, which is how the app resolves
 * the tenant. Runs in global setup so specs that never enroll a user (e.g. the purchase flow)
 * don't depend on some other spec having synced the host first.
 */
export async function ensureCourseHostForE2E() {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const host = new URL(baseUrl).host;

  const existing = await db.course.findUnique({ where: { host } });
  if (existing) {
    return existing;
  }

  const course = await db.course.findFirst();
  if (!course) {
    throw new Error("No course found in database. Cannot run e2e tests.");
  }

  return db.course.update({ where: { id: course.id }, data: { host } });
}

export async function enrollUserInCourse(userId: string) {
  const course = await ensureCourseHostForE2E();

  await db.userCourse.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id },
    update: {},
  });
}

export async function cleanupUserCourseData(userId: string) {
  await Promise.all([
    ProgressService.resetAllLesson(userId),
    QuizService.resetAllProgress(userId),
    db.userCourse.deleteMany({ where: { userId } }),
  ]);
  await invalidateAllProgressCacheForUser(userId);
}

export async function resetProgressForUser(userId: string) {
  await Promise.all([ProgressService.resetAllLesson(userId), QuizService.resetAllProgress(userId)]);
  await invalidateAllProgressCacheForUser(userId);
}

export async function markLessonCompleteForUser(
  userId: string,
  lesson: { id: number; attributes: { required_duration_in_seconds?: number | null } },
) {
  const progress = await ProgressService.markComplete({
    userId,
    lessonId: lesson.id,
    requiredDurationInSeconds: lesson.attributes.required_duration_in_seconds ?? undefined,
  });
  await invalidateLessonProgressCache(userId, lesson.id);
  return progress;
}

export async function markQuizPassedForUser(userId: string, quizId: number, score = 100) {
  const progress = await QuizService.markAsPassed(quizId, userId, score);
  await invalidateQuizProgressCache(userId, quizId);
  return progress;
}
