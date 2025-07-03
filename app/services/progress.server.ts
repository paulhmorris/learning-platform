import { UserLessonProgress } from "@prisma/client";

import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { SUBMIT_INTERVAL_MS } from "~/routes/api.lesson-progress";
import { CacheKeys, CacheService } from "~/services/cache.server";

const logger = createLogger("ProgressService");

export const ProgressService = {
  async incrementProgress(userId: string, lessonId: number) {
    try {
      const progress = await db.userLessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: { userId, lessonId, durationInSeconds: SUBMIT_INTERVAL_MS / 1_000 },
        update: { durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 } },
      });
      await CacheService.set(CacheKeys.progressLesson(userId, lessonId), progress, { ex: 12 });
      return progress;
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ userId, lessonId, error }, "Failed to increment progress");
      throw error;
    }
  },

  async getByLessonId(userId: string, lessonId: number) {
    try {
      const cachedProgress = await CacheService.get<UserLessonProgress>(CacheKeys.progressLesson(userId, lessonId));
      if (cachedProgress) {
        logger.debug({ userId, lessonId }, "Returning cached progress");
        return cachedProgress;
      }
      const progress = await db.userLessonProgress.findUnique({
        where: {
          userId_lessonId: { lessonId, userId },
        },
      });
      if (progress) {
        await CacheService.set(CacheKeys.progressLesson(userId, lessonId), progress, { ex: 12 });
      }
      logger.debug({ userId, lessonId }, "Returning progress");
      return progress;
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ userId, lessonId, error }, "Failed to retrieve progress by lesson ID");
      throw error;
    }
  },

  async getAll(userId: string) {
    try {
      logger.debug({ userId }, "Retrieving all lesson progress for user");
      return db.userLessonProgress.findMany({ where: { userId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ userId, error }, "Failed to retrieve all progress for user");
      throw error;
    }
  },

  async getAllQuiz(userId: string) {
    try {
      logger.debug({ userId }, "Retrieving all quiz progress for user");
      return db.userQuizProgress.findMany({ where: { userId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ userId, error }, "Failed to retrieve all quiz progress for user");
      throw error;
    }
  },

  async resetAll(userId: string) {
    try {
      logger.info({ userId }, "Resetting all progress for user");
      return db.userLessonProgress.deleteMany({ where: { userId } });
    } catch (error) {
      Sentry.captureException(error);
      logger.info({ userId, error }, "Failed to reset all progress for user");
      throw error;
    }
  },

  async resetLesson(lessonId: number, userId: string) {
    try {
      logger.info({ lessonId, userId }, "Resetting lesson progress");
      return db.userLessonProgress.delete({
        where: {
          userId_lessonId: { lessonId, userId },
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ lessonId, userId, error }, "Failed to reset lesson progress");
      throw error;
    }
  },

  async updateProgress(data: {
    lessonId: number;
    userId: string;
    durationInSeconds: number;
    requiredDurationInSeconds: number;
  }) {
    try {
      logger.debug(
        { lessonId: data.lessonId, userId: data.userId, durationInSeconds: data.durationInSeconds },
        "Updating progress",
      );
      return db.userLessonProgress.upsert({
        where: {
          userId_lessonId: { userId: data.userId, lessonId: data.lessonId },
        },
        create: {
          userId: data.userId,
          lessonId: data.lessonId,
          isCompleted: data.durationInSeconds >= data.requiredDurationInSeconds,
          durationInSeconds: data.durationInSeconds,
        },
        update: {
          durationInSeconds: data.durationInSeconds,
          isCompleted: data.durationInSeconds >= data.requiredDurationInSeconds,
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ lessonId: data.lessonId, userId: data.userId, error }, "Failed to update progress");
      throw error;
    }
  },

  async markComplete(data: { lessonId: number; userId: string; requiredDurationInSeconds?: number }) {
    try {
      const progress = await db.userLessonProgress.upsert({
        where: {
          userId_lessonId: { lessonId: data.lessonId, userId: data.userId },
        },
        create: {
          lessonId: data.lessonId,
          userId: data.userId,
          durationInSeconds: data.requiredDurationInSeconds,
          isCompleted: true,
        },
        update: {
          durationInSeconds: data.requiredDurationInSeconds,
          isCompleted: true,
        },
      });
      await CacheService.set(CacheKeys.progressLesson(data.userId, data.lessonId), progress, { ex: 12 });
      logger.info({ lessonId: data.lessonId, userId: data.userId }, "Marked lesson as complete");
      return progress;
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ lessonId: data.lessonId, userId: data.userId, error }, "Failed to mark lesson as complete");
      throw error;
    }
  },
};
