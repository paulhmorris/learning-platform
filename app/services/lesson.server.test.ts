import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/cms.server", () => ({
  cms: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("~/services/cache.server", () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  CacheKeys: {
    lessonsAll: () => "lessons:all",
    lesson: (slug: string) => `lesson:${slug}`,
    lessonDuration: (id: number) => `lesson:duration:${id}`,
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { cms } from "~/integrations/cms.server";
import { Sentry } from "~/integrations/sentry";
import { CacheService } from "~/services/cache.server";

import { LessonService } from "./lesson.server";

const mockCms = vi.mocked(cms, true);
const mockCache = vi.mocked(CacheService, true);

describe("LessonService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllFromCMS", () => {
    it("returns cached lessons when available", async () => {
      const lessons = { data: [{ id: 1 }], meta: {} };
      mockCache.get.mockResolvedValue(lessons);

      const result = await LessonService.getAllFromCMS();
      expect(result).toEqual(lessons);
      expect(mockCms.find).not.toHaveBeenCalled();
    });

    it("fetches from CMS and caches when no cache hit", async () => {
      const lessons = { data: [{ id: 1 }], meta: {} };
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockResolvedValue(lessons as never);

      const result = await LessonService.getAllFromCMS();
      expect(result).toEqual(lessons);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("CMS error");
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockRejectedValue(error);

      await expect(LessonService.getAllFromCMS()).rejects.toThrow("CMS error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("getBySlugWithContent", () => {
    it("returns cached lesson when available", async () => {
      const lesson = { id: 1, attributes: { title: "Intro" } };
      mockCache.get.mockResolvedValue(lesson);

      const result = await LessonService.getBySlugWithContent("intro");
      expect(result).toEqual(lesson);
      expect(mockCms.find).not.toHaveBeenCalled();
    });

    it("fetches from CMS and returns the lesson", async () => {
      const lesson = { id: 1, attributes: { title: "Intro" } };
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockResolvedValue({ data: [lesson], meta: {} } as never);

      const result = await LessonService.getBySlugWithContent("intro");
      expect(result).toEqual(lesson);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("throws when multiple lessons found with the same slug", async () => {
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }], meta: {} } as never);

      await expect(LessonService.getBySlugWithContent("dup")).rejects.toThrow(
        "Multiple lessons found with the same slug",
      );
    });

    it("throws when no lesson found", async () => {
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockResolvedValue({ data: [], meta: {} } as never);

      await expect(LessonService.getBySlugWithContent("missing")).rejects.toThrow("Lesson not found");
    });
  });

  describe("getDuration", () => {
    it("returns cached duration when available", async () => {
      mockCache.get.mockResolvedValue(300);

      const result = await LessonService.getDuration(1);
      expect(result).toBe(300);
      expect(mockCms.findOne).not.toHaveBeenCalled();
    });

    it("fetches from CMS and caches when no cache hit", async () => {
      mockCache.get.mockResolvedValue(null);
      mockCms.findOne.mockResolvedValue({
        data: { attributes: { required_duration_in_seconds: 600 } },
      } as never);

      const result = await LessonService.getDuration(1);
      expect(result).toBe(600);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("does not cache when duration is null", async () => {
      mockCache.get.mockResolvedValue(null);
      mockCms.findOne.mockResolvedValue({
        data: { attributes: { required_duration_in_seconds: null } },
      } as never);

      const result = await LessonService.getDuration(1);
      expect(result).toBeNull();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });
});
