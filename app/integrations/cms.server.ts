import { RootNode } from "@strapi/blocks-react-renderer/dist/BlocksRenderer";
import Strapi from "strapi-sdk-js";

export const cms = new Strapi({
  url: process.env.STRAPI_URL,
});
cms.axios.defaults.headers.common["Authorization"] = `Bearer ${process.env.STRAPI_TOKEN}`;

type StrapiImageFormats = "thumbnail" | "small" | "medium" | "large";
export type StrapiImage = {
  name: string;
  alternativeText: string;
  caption: string;
  width: number;
  height: number;
  formats: {
    [key in StrapiImageFormats]: {
      name: string;
      hash: string;
      ext: string;
      mime: string;
      width: number;
      height: number;
      size: number;
      url: string;
    };
  };
};

export type Course = {
  id: number;
  attributes: {
    title: string;
    short_description: string | null;
    long_description: string | null;
    slug: string;
    cover_image: {
      data: {
        id: string;
        attributes: StrapiImage;
      };
    } | null;
    [key: string]: any;
  };
};

export type Lesson = {
  id: number;
  attributes: {
    title: string;
    short_description: string | null;
    long_description: string | null;
    slug: string;
    text_content: Array<RootNode>;
    [key: string]: any;
  };
};
