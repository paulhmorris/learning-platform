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
      console.debug(`Skipping cache get for key ${key} in dev/test environment`);
      return null;
    }

    console.debug(`Getting cache key: ${key}`);
    return redis.get<T>(key);
  },

  async set<T>(key: CacheKey, value: T, opts: SetCommandOptions = {}) {
    if (CONFIG.isDev || CONFIG.isTest) {
      console.debug(`Skipping cache set for key ${key} in dev/test environment`);
      return;
    }

    opts.ex ??= DEFAULT_TTL;

    console.debug(`Setting cache key: ${key} with TTL: ${opts.ex}s`);
    await redis.set(key, value, opts);
  },

  async delete(key: CacheKey) {
    if (CONFIG.isDev || CONFIG.isTest) {
      console.debug(`Skipping cache delete for key ${key} in dev/test environment`);
      return;
    }

    console.debug(`Deleting cache key: ${key}`);
    await redis.del(key);
  },
};
