import Strapi from "strapi-sdk-js";

import { notFound, serverError } from "~/lib/responses.server";
import { APIResponseCollection, APIResponseData } from "~/types/utils";

export const cms = new Strapi({
  url: process.env.STRAPI_URL,
});
cms.axios.defaults.headers.common["Authorization"] = `Bearer ${process.env.STRAPI_TOKEN}`;

export function getCourse(id: number) {
  return cms.findOne<APIResponseData<"api::course.course">>("courses", id, {
    fields: ["title"],
    populate: {
      sections: {
        fields: ["title"],
        populate: {
          quiz: {
            fields: ["title", "uuid"],
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
}

export function getCoursePreview(id: number) {
  return cms.findOne<APIResponseData<"api::course.course">>("courses", id, {
    fields: ["title"],
    populate: {
      cover_image: {
        fields: ["alternativeText", "formats", "url"],
      },
      sections: {
        fields: ["title"],
        populate: {
          quiz: {
            fields: ["title", "uuid"],
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
}

export async function getLessonBySlug(slug: string) {
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

  return lesson.data[0];
}
