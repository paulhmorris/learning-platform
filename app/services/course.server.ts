import { Course } from "@prisma/client";
import { StrapiResponse } from "strapi-sdk-js";

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";

const TTL = 120;
type AllCoursesCMS = APIResponseCollection<"api::course.course">["data"];
type CourseCMS = StrapiResponse<APIResponseData<"api::course.course">>;

export const CourseService = {
  async getByHost(host: string) {
    const cachedCourse = await redis.get<Course>(`course-root-db-${host}`);
    if (cachedCourse) {
      return cachedCourse;
    }

    const course = await db.course.findUnique({ where: { host } });
    if (!course) {
      return null;
    }

    await redis.set<Course>(`course-root-db-${host}`, course, { ex: TTL });
    return course;
  },

  async getById(id: string) {
    return db.course.findUniqueOrThrow({ where: { id } });
  },

  async getFromCMSForRoot(strapiId: string | number) {
    const cachedCourse = await redis.get<CourseCMS>(`course-root-cms-${strapiId}`);
    if (cachedCourse) {
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
      return null;
    }

    await redis.set(`course-root-cms-${strapiId}`, course, { ex: TTL });
    return course;
  },

  async getFromCMSForCourseLayout(strapiId: string | number) {
    const cachedCourse = await redis.get<CourseCMS>(`course-course-layout-cms-${strapiId}`);
    if (cachedCourse) {
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
      return null;
    }

    await redis.set(`course-course-layout-cms-${strapiId}`, course, { ex: TTL });
    return course;
  },

  async getAll() {
    const cachedCourses = await redis.get<AllCoursesCMS>(`courses-all`);
    if (cachedCourses && cachedCourses.length > 0) {
      return cachedCourses;
    }

    const courses = await cms.find<AllCoursesCMS>("courses", {
      fields: ["title", "description"],
    });

    if (courses.data.length === 0) {
      return [];
    }

    await redis.set(`courses-all`, courses.data, { ex: TTL });
    return courses.data;
  },
};
