import { cms } from "~/integrations/cms.server";
import { redis } from "~/integrations/redis.server";
import { Responses } from "~/lib/responses.server";
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
      throw Responses.serverError();
    }

    if (lesson.data.length === 0) {
      throw Responses.notFound("Lesson not found.");
    }

    await redis.set(`lesson:${slug}`, lesson.data[0], { ex: 60 });
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
      await redis.set(`lesson-duration:${lessonId}`, lesson.data.attributes.required_duration_in_seconds, {
        ex: 60,
      });
    }
    return lesson.data.attributes.required_duration_in_seconds;
  },
};
