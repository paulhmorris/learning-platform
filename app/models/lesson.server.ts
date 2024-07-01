import { UserLessonProgress } from "@prisma/client";

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { notFound, serverError } from "~/lib/responses.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";
type Lesson = APIResponseCollection<"api::lesson.lesson">["data"][0];

export async function getLessons() {
  return cms.find<APIResponseCollection<"api::lesson.lesson">["data"]>("lessons", {
    fields: ["title", "required_duration_in_seconds", "uuid"],
  });
}

export async function getLessonBySlugWithContent(slug: string) {
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
}

export async function getLessonDuration(lessonId: number) {
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
}

export async function getUserLessonProgress(userId: string, lessonId: number) {
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
}

export async function setUserLessonProgressComplete({
  userId,
  lessonId,
  duration,
}: {
  userId: string;
  lessonId: number;
  duration: number;
}) {
  const progress = await db.userLessonProgress.update({
    where: {
      userId_lessonId: {
        lessonId,
        userId,
      },
    },
    data: {
      isCompleted: true,
      durationInSeconds: duration,
    },
  });
  await redis.set<UserLessonProgress>(`user-lesson-progress:${userId}:${lessonId}`, progress, { ex: 12 });
  return progress;
}

export async function getAllLessonProgress(userId: string) {
  return db.userLessonProgress.findMany({ where: { userId } });
}

export async function resetAllLessonProgress(userId: string) {
  return db.userLessonProgress.deleteMany({ where: { userId } });
}

export async function resetLessonProgress(lessonId: number, userId: string) {
  return db.userLessonProgress.delete({
    where: {
      userId_lessonId: {
        lessonId,
        userId,
      },
    },
  });
}

export async function updateLessonProgress(data: {
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
}

export async function markLessonComplete(data: {
  lessonId: number;
  userId: string;
  requiredDurationInSeconds: number;
}) {
  const lesson = await db.userLessonProgress.upsert({
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
  return lesson;
}
