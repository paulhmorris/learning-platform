import { SetCommandOptions } from "@upstash/redis";

import { CONFIG } from "~/config.server";
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
  | `user-lesson-progress:${string}:all`;

export const CacheKeys = {
  coursesAll: () => `cms:course:all`,
  courseRoot: (host: string) => `db:course:root:${host}`,
  courseRootCMS: (strapiId: string | number) => `cms:course:root:${strapiId}`,
  courseLayoutCMS: (strapiId: string | number) => `cms:course:layout:${strapiId}`,
  lesson: (slug: string) => `lesson:${slug}`,
  lessonDuration: (lessonId: number) => `lesson-duration:${lessonId}`,
  progressLesson: (userId: string, lessonId: number) => `user-lesson-progress:${userId}:${lessonId}`,
  progressQuiz: (userId: string, quizId: number) => `user-quiz-progress:${userId}:${quizId}`,
  progressAll: (userId: string) => `user-lesson-progress:${userId}:all`,
} satisfies Record<string, (...args: any) => CacheKey>;

const logger = createLogger("CacheService");

const DEFAULT_TTL = 60 * 60; // 1 hour

export const CacheService = {
  async get<T>(key: CacheKey) {
    if (CONFIG.isDev || CONFIG.isTest) {
      return null;
    }

    try {
      logger.debug("Getting cache item", { key });
      return redis.get<T>(key);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get cache item", { error, key });
      throw error;
    }
  },

  async set<T>(key: CacheKey, value: T, opts: SetCommandOptions = {}) {
    if (CONFIG.isDev || CONFIG.isTest) {
      return;
    }

    opts.ex ??= DEFAULT_TTL;

    try {
      logger.debug("Setting cache item", { key, ttl: opts.ex });
      await redis.set(key, value, opts);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to set cache item", { error, key });
      throw error;
    }
  },

  async delete(key: CacheKey) {
    if (CONFIG.isDev || CONFIG.isTest) {
      return;
    }

    try {
      logger.debug("Deleting cache item", { key });
      await redis.del(key);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to delete cache item", { error, key });
      throw error;
    }
  },
};
