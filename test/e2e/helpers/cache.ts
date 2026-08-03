import { redis } from "~/integrations/redis.server";
import { CacheKeys } from "~/services/cache.server";

// Matches the `lesson-duration:*` pattern the admin cache page lists, so seeded
// keys show up without needing the app server's own CacheService (a no-op in dev/test).
export function e2eCacheKey(suffix: string) {
  return `lesson-duration:e2e-${suffix}`;
}

export async function seedCacheKey(key: string, ttlSeconds = 300) {
  await redis.set(key, "e2e-test-value", { ex: ttlSeconds });
}

export async function deleteCacheKey(key: string) {
  await redis.del(key);
}

/*
 * Progress cache invalidation.
 *
 * Tests mutate progress by calling the services directly, but `CacheService` is a no-op in
 * the Playwright process (`SERVER_CONFIG.isTest` — Playwright sets PLAYWRIGHT_TEST), so those
 * writes never invalidate what the server under test is serving: it keeps returning stale
 * progress for up to PROGRESS_CACHE_TTL (22s). Deleting the keys from here makes the next
 * page load reflect the mutation.
 */

export async function invalidateLessonProgressCache(userId: string, lessonId: number) {
  await redis.del(CacheKeys.lessonProgress(userId, lessonId), CacheKeys.lessonProgressAll(userId));
}

export async function invalidateQuizProgressCache(userId: string, quizId: number) {
  await redis.del(CacheKeys.quizProgress(userId, quizId), CacheKeys.quizProgressAll(userId));
}

/**
 * Drops every cached progress entry for a user. Used by the reset/cleanup helpers, which
 * don't know which lessons and quizzes had progress; prefer the targeted helpers above when
 * the ID is known, since KEYS scans the whole (shared) keyspace.
 */
export async function invalidateAllProgressCacheForUser(userId: string) {
  // `<prefix>:all` -> `<prefix>:*`, so the per-lesson/per-quiz keys are covered too and the
  // patterns can't drift from CacheKeys.
  const patterns = [CacheKeys.lessonProgressAll(userId), CacheKeys.quizProgressAll(userId)].map((key) =>
    key.replace(/all$/, "*"),
  );

  const keys = (await Promise.all(patterns.map((pattern) => redis.keys(pattern)))).flat();
  if (keys.length === 0) {
    return;
  }

  await redis.del(...keys);
}
