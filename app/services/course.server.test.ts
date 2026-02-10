import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/db.server", () => ({
  db: {
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

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
    courseRoot: (host: string) => `course:root:${host}`,
    courseRootCMS: (id: string | number) => `course:root:cms:${id}`,
    courseLayoutCMS: (id: string | number) => `course:layout:cms:${id}`,
    coursesAll: () => "courses:all",
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { CacheService } from "~/services/cache.server";

import { CourseService } from "./course.server";

const mockDb = vi.mocked(db, true);
const mockCms = vi.mocked(cms, true);
const mockCache = vi.mocked(CacheService, true);

describe("CourseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getByHost", () => {
    it("returns cached course when available", async () => {
      const course = { id: "c1", host: "example.com" };
      mockCache.get.mockResolvedValue(course);

      const result = await CourseService.getByHost("example.com");
      expect(result).toEqual(course);
      expect(mockDb.course.findUnique).not.toHaveBeenCalled();
    });

    it("fetches from DB and caches when no cache hit", async () => {
      const course = { id: "c1", host: "example.com" };
      mockCache.get.mockResolvedValue(null);
      mockDb.course.findUnique.mockResolvedValue(course as never);

      const result = await CourseService.getByHost("example.com");
      expect(result).toEqual(course);
      expect(mockDb.course.findUnique).toHaveBeenCalledWith({ where: { host: "example.com" } });
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("falls back to first course for localhost preview host", async () => {
      const fallbackCourse = { id: "c1", host: "real.com" };
      mockCache.get.mockResolvedValue(null);
      mockDb.course.findUnique.mockResolvedValue(null);
      mockDb.course.findFirst.mockResolvedValue(fallbackCourse as never);

      const result = await CourseService.getByHost("localhost:3000");
      expect(result).toEqual(fallbackCourse);
      expect(mockDb.course.findFirst).toHaveBeenCalled();
    });

    it("falls back to first course for vercel preview host", async () => {
      const fallbackCourse = { id: "c1", host: "real.com" };
      mockCache.get.mockResolvedValue(null);
      mockDb.course.findUnique.mockResolvedValue(null);
      mockDb.course.findFirst.mockResolvedValue(fallbackCourse as never);

      const result = await CourseService.getByHost("my-app-cosmic-labs.vercel.app");
      expect(result).toEqual(fallbackCourse);
    });

    it("returns null when no course found and not a preview host", async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.course.findUnique.mockResolvedValue(null);

      const result = await CourseService.getByHost("unknown.com");
      expect(result).toBeNull();
    });
  });

  describe("getById", () => {
    it("delegates to db.course.findUniqueOrThrow", async () => {
      const course = { id: "c1" };
      mockDb.course.findUniqueOrThrow.mockResolvedValue(course as never);

      const result = await CourseService.getById("c1");
      expect(result).toEqual(course);
      expect(mockDb.course.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "c1" } });
    });
  });

  describe("getFromCMSForRoot", () => {
    it("returns cached CMS course when available", async () => {
      const course = { data: { id: 1, attributes: { title: "Test" } } };
      mockCache.get.mockResolvedValue(course);

      const result = await CourseService.getFromCMSForRoot(1);
      expect(result).toEqual(course);
      expect(mockCms.findOne).not.toHaveBeenCalled();
    });

    it("fetches from CMS and caches when no cache hit", async () => {
      const course = { data: { id: 1, attributes: { title: "Test" } } };
      mockCache.get.mockResolvedValue(null);
      mockCms.findOne.mockResolvedValue(course as never);

      const result = await CourseService.getFromCMSForRoot(1);
      expect(result).toEqual(course);
      expect(mockCms.findOne).toHaveBeenCalledWith("courses", 1, expect.any(Object));
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("returns null when CMS returns no course", async () => {
      mockCache.get.mockResolvedValue(null);
      mockCms.findOne.mockResolvedValue(undefined as never);

      const result = await CourseService.getFromCMSForRoot(999);
      expect(result).toBeNull();
    });
  });

  describe("getFromCMSForCourseLayout", () => {
    it("returns cached layout when available", async () => {
      const course = { data: { id: 1, attributes: { title: "Test" } } };
      mockCache.get.mockResolvedValue(course);

      const result = await CourseService.getFromCMSForCourseLayout(1);
      expect(result).toEqual(course);
      expect(mockCms.findOne).not.toHaveBeenCalled();
    });

    it("fetches from CMS and caches when no cache hit", async () => {
      const course = { data: { id: 1, attributes: { title: "Test" } } };
      mockCache.get.mockResolvedValue(null);
      mockCms.findOne.mockResolvedValue(course as never);

      const result = await CourseService.getFromCMSForCourseLayout(1);
      expect(result).toEqual(course);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe("getAll", () => {
    it("returns cached courses when available", async () => {
      const courses = [{ id: 1 }, { id: 2 }];
      mockCache.get.mockResolvedValue(courses);

      const result = await CourseService.getAll();
      expect(result).toEqual(courses);
      expect(mockCms.find).not.toHaveBeenCalled();
    });

    it("fetches from CMS and caches when no cache hit", async () => {
      const data = [{ id: 1 }, { id: 2 }];
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockResolvedValue({ data, meta: {} } as never);

      const result = await CourseService.getAll();
      expect(result).toEqual(data);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("returns empty array when no courses found", async () => {
      mockCache.get.mockResolvedValue(null);
      mockCms.find.mockResolvedValue({ data: [], meta: {} } as never);

      const result = await CourseService.getAll();
      expect(result).toEqual([]);
    });
  });
});
