import Strapi from "strapi-sdk-js";

export const cms = new Strapi({
  url: process.env.STRAPI_URL,
});
cms.axios.defaults.headers.common["Authorization"] = `Bearer ${process.env.STRAPI_TOKEN}`;
