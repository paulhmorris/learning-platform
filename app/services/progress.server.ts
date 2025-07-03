import { UserLessonProgress } from "@prisma/client";

import { db } from "~/integrations/db.server";
import { SUBMIT_INTERVAL_MS } from "~/routes/api.lesson-progress";
import { CacheKeys, CacheService } from "~/services/cache.server";

export const ProgressService = {
  async incrementProgress(userId: string, lessonId: number) {
    const progress = await db.userLessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, durationInSeconds: SUBMIT_INTERVAL_MS / 1_000 },
      update: { durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 } },
    });
    await CacheService.set(CacheKeys.progressLesson(userId, lessonId), progress, { ex: 12 });
    return progress;
  },

  async getByLessonId(userId: string, lessonId: number) {
    const cachedProgress = await CacheService.get<UserLessonProgress>(CacheKeys.progressLesson(userId, lessonId));
    if (cachedProgress) {
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
    return progress;
  },

  async getAll(userId: string) {
    return db.userLessonProgress.findMany({ where: { userId } });
  },

  async getAllQuiz(userId: string) {
    return db.userQuizProgress.findMany({ where: { userId } });
  },

  async resetAll(userId: string) {
    return db.userLessonProgress.deleteMany({ where: { userId } });
  },

  async resetLesson(lessonId: number, userId: string) {
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
    await CacheService.set(CacheKeys.progressLesson(data.userId, data.lessonId), progress, { ex: 12 });
    return progress;
  },
};
