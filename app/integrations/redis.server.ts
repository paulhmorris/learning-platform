import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  /** A function, so each command gets its own timeout rather than one shared from boot. */
  signal: () => AbortSignal.timeout(3_000),
});
