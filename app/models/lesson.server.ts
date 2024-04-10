import { UserLessonProgress } from "@prisma/client";

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { notFound, serverError } from "~/lib/responses.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";

type Lesson = APIResponseCollection<"api::lesson.lesson">["data"][0];
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
