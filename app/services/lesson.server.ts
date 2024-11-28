import { UserLessonProgress } from "@prisma/client";

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { notFound, serverError } from "~/lib/responses.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";
type Lesson = APIResponseCollection<"api::lesson.lesson">["data"][0];

export const LessonService = {
  async getAllFromCMS() {
    return cms.find<APIResponseCollection<"api::lesson.lesson">["data"]>("lessons", {
      fields: ["title", "required_duration_in_seconds", "uuid"],
    });
  },

  async getBySlugWithContent(slug: string) {
    const cachedLesson = await redis.get<Lesson>(`lesson:${slug}`);
    if (cachedLesson) {
      return cachedLesson;
    }
    const lesson = await cms.find<APIResponseCollection<"api::lesson.lesson">["data"]>("lessons", {
      filters: { slug },
      fields: ["title", "required_duration_in_seconds"],
      populate: {
        content: {
          populate: "*",
        },
      },
    });

    if (lesson.data.length > 1) {
      throw serverError("Multiple courses with the same slug found.");
    }

    if (lesson.data.length === 0) {
      throw notFound("Course not found.");
    }

    await redis.set<Lesson>(`lesson:${slug}`, lesson.data[0], { ex: 60 });
    return lesson.data[0];
  },

  async getDuration(lessonId: number) {
    const cachedLesson = await redis.get<number>(`lesson-duration:${lessonId}`);
    if (cachedLesson) {
      return cachedLesson;
    }
    const lesson = await cms.findOne<APIResponseData<"api::lesson.lesson">>("lessons", lessonId, {
      fields: ["required_duration_in_seconds"],
    });
    if (lesson.data.attributes.required_duration_in_seconds) {
      await redis.set<number>(`lesson-duration:${lessonId}`, lesson.data.attributes.required_duration_in_seconds, {
        ex: 60,
      });
    }
    return lesson.data.attributes.required_duration_in_seconds;
  },

  async getProgress(userId: string, lessonId: number) {
    const cachedProgress = await redis.get<UserLessonProgress>(`user-lesson-progress:${userId}:${lessonId}`);
    if (cachedProgress) {
      return cachedProgress;
    }
    const progress = await db.userLessonProgress.findUnique({
      where: {
        userId_lessonId: {
          lessonId,
          userId,
        },
      },
    });
    if (progress) {
      await redis.set<UserLessonProgress>(`user-lesson-progress:${userId}:${lessonId}`, progress, { ex: 12 });
    }
    return progress;
  },

  async getAllProgress(userId: string) {
    return db.userLessonProgress.findMany({ where: { userId } });
  },

  async resetAllProgress(userId: string) {
    return db.userLessonProgress.deleteMany({ where: { userId } });
  },

  async resetProgress(lessonId: number, userId: string) {
    return db.userLessonProgress.delete({
      where: {
        userId_lessonId: {
          lessonId,
          userId,
        },
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
        userId_lessonId: {
          lessonId: data.lessonId,
          userId: data.userId,
        },
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
    await redis.set<UserLessonProgress>(`user-lesson-progress:${data.userId}:${data.lessonId}`, progress, { ex: 12 });
    return progress;
  },
};
