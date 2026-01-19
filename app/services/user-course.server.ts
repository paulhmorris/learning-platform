import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("UserCourseService");

export const UserCourseService = {
  getAllByUserId: async (userId: string) => {
    logger.debug(`Fetching courses for user ${userId}`);
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
      logger.error(`Failed to fetch courses for user ${userId}`, { error });
      throw error;
    }
  },

  getByUserIdAndCourseIdWithCertificate: async (userId: string, courseId: string) => {
    logger.debug(`Fetching course ${courseId} for user ${userId} with certificate`);
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
      logger.error(`Failed to fetch course ${courseId} for user ${userId}`, { error });
      throw error;
    }
  },

  enrollUser: async (userId: string, courseId: string) => {
    logger.debug(`Creating userCourse for user ${userId} and course ${courseId}`);
    try {
      return db.userCourse.create({ data: { userId, courseId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to create userCourse for user ${userId} and course ${courseId}`, { error });
      throw error;
    }
  },
};
