import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/config.server", () => ({
  SERVER_CONFIG: { isDev: false, isTest: false },
}));

vi.mock("~/integrations/redis.server", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { SERVER_CONFIG } from "~/config.server";
import { redis } from "~/integrations/redis.server";
import { Sentry } from "~/integrations/sentry";

import { CacheService } from "./cache.server";

const mockRedis = vi.mocked(redis);
const mockConfig = vi.mocked(SERVER_CONFIG, true);

describe("CacheService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to production-like environment
    Object.assign(mockConfig, { isDev: false, isTest: false });
  });

  describe("get", () => {
    it("returns cached value from redis", async () => {
      mockRedis.get.mockResolvedValue("cached-value");
      const result = await CacheService.get("cms:course:all");
      expect(mockRedis.get).toHaveBeenCalledWith("cms:course:all");
      expect(result).toBe("cached-value");
    });

    it("returns null in dev environment", async () => {
      Object.assign(mockConfig, { isDev: true });
      const result = await CacheService.get("cms:course:all");
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("returns null in test environment", async () => {
      Object.assign(mockConfig, { isTest: true });
      const result = await CacheService.get("cms:course:all");
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("propagates redis errors in get", async () => {
      const error = new Error("Redis error");
      mockRedis.get.mockRejectedValue(error);

      await expect(CacheService.get("cms:course:all")).rejects.toThrow("Redis error");
    });
  });

  describe("set", () => {
    it("sets a value in redis with default TTL", async () => {
      await CacheService.set("cms:course:all", { data: "test" });
      expect(mockRedis.set).toHaveBeenCalledWith("cms:course:all", { data: "test" }, { ex: 3600 });
    });

    it("sets a value with custom TTL", async () => {
      await CacheService.set("cms:course:all", "val", { ex: 120 });
      expect(mockRedis.set).toHaveBeenCalledWith("cms:course:all", "val", { ex: 120 });
    });

    it("skips in dev environment", async () => {
      Object.assign(mockConfig, { isDev: true });
      await CacheService.set("cms:course:all", "val");
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("captures exception on redis error without throwing", async () => {
      const error = new Error("Redis set error");
      mockRedis.set.mockRejectedValue(error);

      await CacheService.set("cms:course:all", "val");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("delete", () => {
    it("deletes a key from redis", async () => {
      await CacheService.delete("cms:course:all");
      expect(mockRedis.del).toHaveBeenCalledWith("cms:course:all");
    });

    it("skips in dev environment", async () => {
      Object.assign(mockConfig, { isDev: true });
      await CacheService.delete("cms:course:all");
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("captures exception on redis error without throwing", async () => {
      const error = new Error("Redis del error");
      mockRedis.del.mockRejectedValue(error);

      await CacheService.delete("cms:course:all");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });
});
