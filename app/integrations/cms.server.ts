import Strapi from "strapi-sdk-js";

export const cms = new Strapi({
  url: process.env.STRAPI_URL,
  axiosOptions: {
    headers: {
      Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
    },
  },
});
