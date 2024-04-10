import Strapi from "strapi-sdk-js";

import { APIResponseData } from "~/types/utils";

export const cms = new Strapi({
  url: process.env.STRAPI_URL,
});
cms.axios.defaults.headers.common["Authorization"] = `Bearer ${process.env.STRAPI_TOKEN}`;

export function getCourse(id: number) {
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
