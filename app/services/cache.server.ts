import { SetCommandOptions } from "@upstash/redis";

import { CONFIG } from "~/config.server";
import { redis } from "~/integrations/redis.server";

type CacheKey =
  | `cms:course:all`
  | `db:course:root:${string}`
  | `cms:course:root:${string | number}`
  | `cms:course:layout:${string | number}`
  | `lesson:${string}`
  | `lesson-duration:${number}`
  | `user-lesson-progress:${string}:${number}`;

export const CacheKeys = {
  coursesAll: () => `cms:course:all`,
  courseRoot: (host: string) => `db:course:root:${host}`,
  courseRootCMS: (strapiId: string | number) => `cms:course:root:${strapiId}`,
  courseLayoutCMS: (strapiId: string | number) => `cms:course:layout:${strapiId}`,
  lesson: (slug: string) => `lesson:${slug}`,
  lessonDuration: (lessonId: number) => `lesson-duration:${lessonId}`,
  progressLesson: (userId: string, lessonId: number) => `user-lesson-progress:${userId}:${lessonId}`,
} satisfies Record<string, (...args: any) => CacheKey>;

const DEFAULT_TTL = 60 * 60; // 1 hour

export const CacheService = {
  async get<T>(key: CacheKey) {
    if (CONFIG.isDev || CONFIG.isTest) {
      return null;
    }

    const data = await redis.get<T>(key);
    return data;
  },

  async set<T>(key: CacheKey, value: T, opts: SetCommandOptions = {}) {
    if (CONFIG.isDev || CONFIG.isTest) {
      return;
    }

    opts.ex ??= DEFAULT_TTL;

    await redis.set(key, value, opts);
  },

  async delete(key: CacheKey) {
    if (CONFIG.isDev || CONFIG.isTest) {
      return;
    }

    await redis.del(key);
  },
};
