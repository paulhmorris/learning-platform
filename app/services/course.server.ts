import { Course } from "@prisma/client";
import { StrapiResponse } from "strapi-sdk-js";

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { CacheKeys, CacheService } from "~/services/cache.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";

const logger = createLogger("CourseService");

const TTL = 120;
type AllCoursesCMS = APIResponseCollection<"api::course.course">["data"];
type CourseCMS = StrapiResponse<APIResponseData<"api::course.course">>;

export const CourseService = {
  async getByHost(host: string) {
    const cachedCourse = await CacheService.get<Course>(CacheKeys.courseRoot(host));
    if (cachedCourse) {
      logger.debug({ host }, "Returning cached course");
      return cachedCourse;
    }

    const course = await db.course.findUnique({ where: { host } });
    if (!course) {
      logger.warn({ host }, "No course found for host");
      return null;
    }

    await CacheService.set(CacheKeys.courseRoot(host), course, { ex: TTL });
    return course;
  },

  async getById(id: string) {
    logger.debug({ id }, "Fetching course by ID");
    return db.course.findUniqueOrThrow({ where: { id } });
  },

  async getFromCMSForRoot(strapiId: string | number) {
    const cachedCourse = await CacheService.get<CourseCMS>(CacheKeys.courseRootCMS(strapiId));
    if (cachedCourse) {
      logger.debug({ strapiId }, "Returning cached course from CMS");
      return cachedCourse;
    }

    const course = await cms.findOne<APIResponseData<"api::course.course">>("courses", strapiId, {
      fields: ["primary_color", "secondary_color", "title"],
      populate: {
        logo: {
          fields: "url",
        },
        dark_mode_logo: {
          fields: "url",
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!course) {
      logger.warn({ strapiId }, "No course found in CMS for ID");
      return null;
    }

    await CacheService.set(CacheKeys.courseRootCMS(strapiId), course, { ex: TTL });
    logger.debug({ strapiId }, "Fetched course from CMS for root");
    return course;
  },

  async getFromCMSForCourseLayout(strapiId: string | number) {
    const cachedCourse = await CacheService.get<CourseCMS>(CacheKeys.courseLayoutCMS(strapiId));
    if (cachedCourse) {
      logger.debug({ strapiId }, "Returning cached course layout from CMS");
      return cachedCourse;
    }

    const course = await cms.findOne<APIResponseData<"api::course.course">>("courses", strapiId, {
      fields: ["title"],
      populate: {
        cover_image: {
          fields: ["alternativeText", "formats", "url"],
        },
        sections: {
          fields: ["title"],
          populate: {
            quiz: {
              fields: ["title", "uuid", "required_duration_in_seconds"],
              populate: {
                questions: {
                  count: true,
                },
              },
            },
            lessons: {
              fields: ["title", "slug", "has_video", "uuid", "required_duration_in_seconds"],
            },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!course) {
      logger.warn({ strapiId }, "No course found in CMS for ID");
      return null;
    }

    await CacheService.set(CacheKeys.courseLayoutCMS(strapiId), course, { ex: TTL });
    logger.debug({ strapiId }, "Fetched course from CMS for layout");
    return course;
  },

  async getAll() {
    const cachedCourses = await CacheService.get<AllCoursesCMS>(CacheKeys.coursesAll());
    if (cachedCourses && cachedCourses.length > 0) {
      logger.debug({ length: cachedCourses.length }, "Returning cached courses");
      return cachedCourses;
    }

    const courses = await cms.find<AllCoursesCMS>("courses", {
      fields: ["title", "description"],
    });

    if (courses.data.length === 0) {
      logger.warn("No courses found");
      return [];
    }

    await CacheService.set(CacheKeys.coursesAll(), courses.data, { ex: TTL });
    logger.debug({ length: courses.data.length }, "Fetched all courses");
    return courses.data;
  },
};
