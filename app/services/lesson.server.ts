import { cms } from "~/integrations/cms.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { CacheKeys, CacheService } from "~/services/cache.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";
type Lesson = APIResponseCollection<"api::lesson.lesson">["data"][0];

const logger = createLogger("LessonService");

export const LessonService = {
  async getAllFromCMS() {
    try {
      logger.debug("Fetching all lessons from CMS");
      return cms.find<APIResponseCollection<"api::lesson.lesson">["data"]>("lessons", {
        fields: ["title", "required_duration_in_seconds", "uuid"],
      });
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
        logger.debug("Returning cached lesson", { slug });
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
        logger.error("Multiple lessons found with the same slug", { slug, count: lesson.data.length });
        throw new Error("Multiple lessons found with the same slug");
      }

      if (lesson.data.length === 0) {
        logger.warn("No lesson found with the given slug", { slug });
        throw new Error("Lesson not found");
      }

      await CacheService.set(CacheKeys.lesson(slug), lesson.data[0], { ex: 60 });
      logger.debug("Fetched lesson from CMS", { slug });
      return lesson.data[0];
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to retrieve lesson", { slug, error });
      throw error;
    }
  },

  async getDuration(lessonId: number) {
    try {
      const cachedLesson = await CacheService.get<number>(CacheKeys.lessonDuration(lessonId));
      if (cachedLesson) {
        logger.debug("Returning cached lesson duration", { lessonId });
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
      logger.debug("Fetched lesson duration from CMS", { lessonId });
      return lesson.data.attributes.required_duration_in_seconds;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to retrieve lesson duration", { lessonId, error });
      throw error;
    }
  },
};
