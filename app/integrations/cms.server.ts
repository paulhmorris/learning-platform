import { z } from "zod";

import { Sentry } from "~/integrations/sentry";

class StrapiService {
  private config: RequestInit;
  private endpoint: string;

  constructor() {
    this.config = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STRAPI_TOKEN}`,
      },
    };

    this.endpoint = new URL(process.env.STRAPI_URL).toString();
  }

  private async getEntries(pluralApiId: string) {
    try {
      const url = new URL(`/api/${pluralApiId}`, this.endpoint).toString();
      const res = await fetch(url, this.config);
      const data = StrapiResponse.parse(await res.json());
      return data;
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      throw error;
    }
  }

  private async getEntry(pluralApiId: string, id: string | number | null) {
    if (id === null) {
      console.warn("Strapi getEntry() ----> ID was null");
      return id;
    }

    try {
      const url = new URL(`/api/${pluralApiId}/${id}`, this.endpoint).toString();
      const res = await fetch(url, this.config);
      const data = StrapiResponse.parse(await res.json());
      return data;
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      throw error;
    }
  }

  getCourse(id: string | number) {
    return this.getEntry("courses", id);
  }

  getCourses() {
    return this.getEntries("courses");
  }

  getLesson(id: string | number) {
    return this.getEntry("lessons", id);
  }

  getLessons() {
    return this.getEntries("lessons");
  }
}

const StrapiMetadata = z.object({
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    pageCount: z.number(),
    total: z.number(),
  }),
});

const StrapiEntry = z.object({
  id: z.number(),
  attributes: z
    .object({
      createdAt: z.string(),
      updatedAt: z.string(),
      publishedAt: z.string(),
    })
    .passthrough(),
});

const StrapiResponse = z.object({
  data: StrapiEntry.or(z.array(StrapiEntry)),
  meta: StrapiMetadata,
});

export const cms = new StrapiService();
