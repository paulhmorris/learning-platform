import { UserLessonProgress, UserQuizProgress } from "@prisma/client";

import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { SUBMIT_INTERVAL_MS } from "~/routes/api.progress";
import { CacheKeys, CacheService } from "~/services/cache.server";

const logger = createLogger("ProgressService");

const PROGRESS_CACHE_TTL = 22; // 22 seconds

export const ProgressService = {
  async incrementProgress(userId: string, lessonId: number) {
    const progress = await db.userLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, durationInSeconds: SUBMIT_INTERVAL_MS / 1_000 },
      update: { durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 } },
    });
    logger.info(`Incremented progress for user ${userId} on lesson ${lessonId}`);
    await CacheService.set(CacheKeys.lessonProgress(userId, lessonId), progress, { ex: PROGRESS_CACHE_TTL });
    return progress;
  },

  async getByLessonId(userId: string, lessonId: number) {
    const cachedProgress = await CacheService.get<UserLessonProgress>(CacheKeys.lessonProgress(userId, lessonId));
    if (cachedProgress) {
      logger.debug(`Returning cached progress for user ${userId} on lesson ${lessonId}`);
      return cachedProgress;
    }
    const progress = await db.userLessonProgress.findUnique({ where: { userId_lessonId: { lessonId, userId } } });
    if (progress) {
      await CacheService.set(CacheKeys.lessonProgress(userId, lessonId), progress, { ex: PROGRESS_CACHE_TTL });
    }
    logger.debug(`Returning progress for user ${userId} on lesson ${lessonId}`);
    return progress;
  },

  async getByQuizId(userId: string, quizId: number) {
    logger.debug(`Retrieving quiz progress for user ${userId} on quiz ${quizId}`);
    const cachedProgress = await CacheService.get<UserQuizProgress>(CacheKeys.quizProgress(userId, quizId));
    if (cachedProgress) {
      logger.debug(`Returning cached quiz progress for user ${userId} on quiz ${quizId}`);
      return cachedProgress;
    }
    const progress = await db.userQuizProgress.findUnique({ where: { userId_quizId: { userId, quizId } } });
    if (progress) {
      await CacheService.set(CacheKeys.quizProgress(userId, quizId), progress, { ex: PROGRESS_CACHE_TTL });
    }
    logger.debug(`Returning quiz progress for user ${userId} on quiz ${quizId}`);
    return progress;
  },

  async getAllLesson(userId: string) {
    logger.debug(`Retrieving all lesson progress for user ${userId}`);
    const cachedProgress = await CacheService.get<Array<UserLessonProgress>>(CacheKeys.lessonProgressAll(userId));
    if (cachedProgress) {
      logger.debug(`Returning cached progress for all lessons for user ${userId}`);
      return cachedProgress;
    }
    const progress = await db.userLessonProgress.findMany({ where: { userId } });
    if (progress.length) {
      await CacheService.set(CacheKeys.lessonProgressAll(userId), progress, { ex: PROGRESS_CACHE_TTL });
    }
    logger.debug(`Returning progress for all lessons for user ${userId}`);
    return progress;
  },

  async getAllQuiz(userId: string) {
    logger.debug(`Retrieving all quiz progress for user ${userId}`);
    const cachedProgress = await CacheService.get<Array<UserQuizProgress>>(CacheKeys.quizProgressAll(userId));
    if (cachedProgress) {
      logger.debug(`Returning cached quiz progress for all quizzes for user ${userId}`);
      return cachedProgress;
    }
    const progress = await db.userQuizProgress.findMany({ where: { userId } });
    if (progress.length) {
      await CacheService.set(CacheKeys.quizProgressAll(userId), progress, { ex: PROGRESS_CACHE_TTL });
    }
    logger.debug(`Returning quiz progress for all quizzes for user ${userId}`);
    return progress;
  },

  async resetAllLesson(userId: string) {
    logger.info(`Resetting all progress for user ${userId}`);
    await CacheService.delete(CacheKeys.lessonProgressAll(userId));
    return db.userLessonProgress.deleteMany({ where: { userId } });
  },

  async resetLesson(lessonId: number, userId: string) {
    logger.info(`Resetting lesson ${lessonId} progress for user ${userId}`);
    await CacheService.delete(CacheKeys.lessonProgress(userId, lessonId));
    return db.userLessonProgress.delete({
      where: {
        userId_lessonId: { lessonId, userId },
      },
    });
  },

  async updateProgress(data: {
    lessonId: number;
    userId: string;
    durationInSeconds: number;
    requiredDurationInSeconds: number;
  }) {
    logger.debug(
      `Updating progress for user ${data.userId} on lesson ${data.lessonId} (duration: ${data.durationInSeconds}s)`,
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
  },

  async markComplete(data: { lessonId: number; userId: string; requiredDurationInSeconds?: number }) {
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
    await CacheService.set(CacheKeys.lessonProgress(data.userId, data.lessonId), progress, { ex: PROGRESS_CACHE_TTL });
    logger.info(`Marked lesson ${data.lessonId} as complete for user ${data.userId}`);
    return progress;
  },
};
