import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { CourseService } from "~/services/course.server";
import { ProgressService } from "~/services/progress.server";
import { QuizService } from "~/services/quiz.server";

const logger = createLogger("E2E.ProgressHelpers");

export async function getCourseLayoutForE2E() {
  logger.debug("Loading course layout for E2E");
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

export async function enrollUserInCourse(userId: string) {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const host = new URL(baseUrl).host;

  logger.info("Enrolling user in course", { userId, host });
  let course = await db.course.findUnique({ where: { host } });
  if (!course) {
    course = await db.course.findFirst();
    if (!course) {
      throw new Error("No course found in database. Cannot enroll user.");
    }

    if (course.host !== host) {
      course = await db.course.update({
        where: { id: course.id },
        data: { host },
      });
    }
  }
  if (!course) {
    throw new Error("No course found in database. Cannot enroll user.");
  }

  await db.userCourse.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id },
    update: {},
  });
}

export async function cleanupUserCourseData(userId: string) {
  logger.info("Cleaning up user course data", { userId });
  await Promise.all([
    ProgressService.resetAllLesson(userId),
    QuizService.resetAllProgress(userId),
    db.userCourse.deleteMany({ where: { userId } }),
  ]);
}

export async function resetProgressForUser(userId: string) {
  logger.info("Resetting user progress", { userId });
  await Promise.all([ProgressService.resetAllLesson(userId), QuizService.resetAllProgress(userId)]);
}

export async function markLessonCompleteForUser(
  userId: string,
  lesson: { id: number; attributes: { required_duration_in_seconds?: number | null } },
) {
  logger.debug("Marking lesson complete for user", { userId, lessonId: lesson.id });
  return ProgressService.markComplete({
    userId,
    lessonId: lesson.id,
    requiredDurationInSeconds: lesson.attributes.required_duration_in_seconds ?? undefined,
  });
}

export async function markQuizPassedForUser(userId: string, quizId: number, score = 100) {
  logger.debug("Marking quiz passed for user", { userId, quizId, score });
  return QuizService.markAsPassed(quizId, userId, score);
}
