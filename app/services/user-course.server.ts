import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("UserCourseService");

export const UserCourseService = {
  getAllByUserId: async (userId: string) => {
    logger.debug("Fetching user courses", { userId });
    try {
      return db.userCourse.findMany({
        select: {
          id: true,
          courseId: true,
          isCompleted: true,
          completedAt: true,
          createdAt: true,
          certificate: {
            select: {
              id: true,
              issuedAt: true,
              s3Key: true,
            },
          },
          course: {
            select: {
              strapiId: true,
            },
          },
        },
        where: { userId },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to fetch user courses", { error, userId });
      throw error;
    }
  },

  getByUserIdAndCourseIdWithCertificate: async (userId: string, courseId: string) => {
    logger.debug(`Fetching course ${courseId} with certificate`, { userId });
    try {
      return db.userCourse.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: {
          certificate: {
            select: {
              id: true,
              issuedAt: true,
              s3Key: true,
            },
          },
          isCompleted: true,
          completedAt: true,
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to fetch course ${courseId}`, { error, userId });
      throw error;
    }
  },

  enrollUser: async (userId: string, courseId: string) => {
    try {
      const course = await db.userCourse.create({ data: { userId, courseId } });
      logger.info(`Successfully enrolled in course ${courseId}`, { userId });
      return course;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to enroll in course ${courseId}`, { error, userId });
      throw error;
    }
  },
};
