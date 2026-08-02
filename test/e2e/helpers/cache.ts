import { redis } from "~/integrations/redis.server";

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
