import { StrapiResponse } from "strapi-sdk-js";

import { cms } from "~/integrations/cms.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { CacheKeys, CacheService } from "~/services/cache.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";
type Lesson = APIResponseCollection<"api::lesson.lesson">["data"][0];

const logger = createLogger("LessonService");

const TTL = 120; // 2 minutes

export const LessonService = {
  async getAllFromCMS() {
    try {
      logger.debug("Fetching all lessons from CMS");
      const cachedLessons = await CacheService.get<StrapiResponse<APIResponseCollection<"api::lesson.lesson">["data"]>>(
        CacheKeys.lessonsAll(),
      );
      if (cachedLessons) {
        logger.debug("Returning cached lessons");
        return cachedLessons;
      }
      const lessons = await cms.find<APIResponseCollection<"api::lesson.lesson">["data"]>("lessons", {
        fields: ["title", "required_duration_in_seconds", "uuid"],
        pagination: { pageSize: 200, page: 1 },
      });
      await CacheService.set(CacheKeys.lessonsAll(), lessons, { ex: TTL });
      logger.debug("Fetched lessons from CMS");
      return lessons;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to retrieve lessons", { error });
      throw error;
    }
  },

  async getBySlugWithContent(slug: string) {
    try {
      const cachedLesson = await CacheService.get<Lesson>(CacheKeys.lesson(slug));
      if (cachedLesson) {
        logger.debug(`Returning cached lesson with slug ${slug}`);
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
        logger.error(`Multiple lessons found with slug ${slug} (count: ${lesson.data.length})`);
        throw new Error("Multiple lessons found with the same slug");
      }

      if (lesson.data.length === 0) {
        logger.warn(`No lesson found with slug ${slug}`);
        throw new Error("Lesson not found");
      }

      await CacheService.set(CacheKeys.lesson(slug), lesson.data[0], { ex: TTL });
      logger.debug(`Fetched lesson from CMS with slug ${slug}`);
      return lesson.data[0];
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to retrieve lesson with slug ${slug}`, { error });
      throw error;
    }
  },

  async getDuration(lessonId: number) {
    try {
      const cachedLesson = await CacheService.get<number>(CacheKeys.lessonDuration(lessonId));
      if (cachedLesson) {
        logger.debug(`Returning cached lesson duration for lesson ${lessonId}`);
        return cachedLesson;
      }
      const lesson = await cms.findOne<APIResponseData<"api::lesson.lesson">>("lessons", lessonId, {
        fields: ["required_duration_in_seconds"],
      });
      if (lesson.data.attributes.required_duration_in_seconds) {
        await CacheService.set(
          CacheKeys.lessonDuration(lessonId),
          lesson.data.attributes.required_duration_in_seconds,
          {
            ex: 60,
          },
        );
      }
      logger.debug(`Fetched lesson duration from CMS for lesson ${lessonId}`);
      return lesson.data.attributes.required_duration_in_seconds;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to retrieve lesson duration for lesson ${lessonId}`, { error });
      throw error;
    }
  },
};
