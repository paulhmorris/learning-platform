import { SetCommandOptions } from "@upstash/redis";

import { SERVER_CONFIG } from "~/config.server";
import { createLogger } from "~/integrations/logger.server";
import { redis } from "~/integrations/redis.server";
import { Sentry } from "~/integrations/sentry";

type CacheKey =
  | `cms:course:all`
  | `db:course:root:${string}`
  | `cms:course:root:${string | number}`
  | `cms:course:layout:${string | number}`
  | `lesson:${string}`
  | `lesson-duration:${number}`
  | `user-lesson-progress:${string}:${number}`
  | `user-quiz-progress:${string}:${number}`
  | `user-lesson-progress:${string}:all`
  | `user-quiz-progress:${string}:all`;

export const CacheKeys = {
  coursesAll: () => `cms:course:all`,
  courseRoot: (host: string) => `db:course:root:${host}`,
  courseRootCMS: (strapiId: string | number) => `cms:course:root:${strapiId}`,
  courseLayoutCMS: (strapiId: string | number) => `cms:course:layout:${strapiId}`,
  lesson: (slug: string) => `lesson:${slug}`,
  lessonsAll: () => `lesson:all`,
  lessonDuration: (lessonId: number) => `lesson-duration:${lessonId}`,
  lessonProgress: (userId: string, lessonId: number) => `user-lesson-progress:${userId}:${lessonId}`,
  quizProgress: (userId: string, quizId: number) => `user-quiz-progress:${userId}:${quizId}`,
  lessonProgressAll: (userId: string) => `user-lesson-progress:${userId}:all`,
  quizProgressAll: (userId: string) => `user-quiz-progress:${userId}:all`,
} satisfies Record<string, (...args: any) => CacheKey>;

/** Key patterns for course/lesson caches only, excluding user-specific progress caches. */
export const COURSE_LESSON_CACHE_PATTERNS = ["cms:course:*", "db:course:*", "lesson:*", "lesson-duration:*"];

const logger = createLogger("CacheService");

const DEFAULT_TTL = 60 * 60; // 1 hour

export const CacheService = {
  async get<T>(key: CacheKey) {
    if (SERVER_CONFIG.isDev || SERVER_CONFIG.isTest) {
      return null;
    }

    try {
      logger.debug(`Getting cache item: ${key}`);
      return await redis.get<T>(key);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to get cache item: ${key}`, { key });
      return null;
    }
  },

  async set<T>(key: CacheKey, value: T, opts: SetCommandOptions = {}) {
    if (SERVER_CONFIG.isDev || SERVER_CONFIG.isTest) {
      return;
    }

    opts.ex ??= DEFAULT_TTL;

    try {
      logger.debug(`Setting cache item: ${key} (TTL: ${opts.ex}s)`);
      await redis.set(key, value, opts);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to set cache item: ${key}`, { key });
      return;
    }
  },

  async delete(key: CacheKey) {
    if (SERVER_CONFIG.isDev || SERVER_CONFIG.isTest) {
      return;
    }

    try {
      logger.debug(`Deleting cache item: ${key}`);
      await redis.del(key);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to delete cache item: ${key}`, { key });
      return;
    }
  },

  /**
   * Lists cached items matching the given key patterns, with their remaining TTL in seconds.
   * Used by the admin cache page, which only surfaces course/lesson caches (not user-specific ones).
   */
  async listByPrefixes(patterns: Array<string>) {
    // Return fake entries for e2e tests
    if (SERVER_CONFIG.isTest) {
      return [
        { key: "cms:course:all", ttl: 3600 },
        { key: "lesson:example-lesson", ttl: 1800 },
      ];
    }

    try {
      const keysByPattern = await Promise.all(patterns.map((pattern) => redis.keys(pattern)));
      const keys = Array.from(new Set(keysByPattern.flat()));
      const ttls = await Promise.all(keys.map((key) => redis.ttl(key)));
      return keys.map((key, i) => ({ key, ttl: ttls[i] })).toSorted((a, b) => a.key.localeCompare(b.key));
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to list cache items");
      return [];
    }
  },

  /** Deletes a cache item by its raw key, as selected from the admin cache page. */
  async deleteRawKey(key: string) {
    if (SERVER_CONFIG.isTest) {
      return;
    }

    try {
      logger.debug(`Deleting cache item: ${key}`);
      await redis.del(key);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to delete cache item: ${key}`, { key });
      return;
    }
  },
};
