import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/db.server", () => ({
  db: {
    userLessonProgress: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
    userQuizProgress: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("~/services/cache.server", () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  CacheKeys: {
    lessonProgress: (userId: string, lessonId: number) => `progress:lesson:${userId}:${lessonId}`,
    lessonProgressAll: (userId: string) => `progress:lesson:all:${userId}`,
    quizProgress: (userId: string, quizId: number) => `progress:quiz:${userId}:${quizId}`,
    quizProgressAll: (userId: string) => `progress:quiz:all:${userId}`,
  },
}));

vi.mock("~/routes/api.progress", () => ({
  SUBMIT_INTERVAL_MS: 30_000,
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

import { db } from "~/integrations/db.server";
import { CacheService } from "~/services/cache.server";

import { ProgressService } from "./progress.server";

const mockDb = vi.mocked(db, true);
const mockCache = vi.mocked(CacheService, true);

describe("ProgressService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("incrementProgress", () => {
    it("upserts progress and caches the result", async () => {
      const progress = { userId: "u1", lessonId: 1, durationInSeconds: 30, isCompleted: false };
      mockDb.userLessonProgress.upsert.mockResolvedValue(progress as never);

      const result = await ProgressService.incrementProgress("u1", 1);
      expect(result).toEqual(progress);
      expect(mockDb.userLessonProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_lessonId: { userId: "u1", lessonId: 1 } },
          create: { userId: "u1", lessonId: 1, durationInSeconds: 30 },
          update: { durationInSeconds: { increment: 30 } },
        }),
      );
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe("getByLessonId", () => {
    it("returns cached progress when available", async () => {
      const progress = { userId: "u1", lessonId: 1, durationInSeconds: 60 };
      mockCache.get.mockResolvedValue(progress);

      const result = await ProgressService.getByLessonId("u1", 1);
      expect(result).toEqual(progress);
      expect(mockDb.userLessonProgress.findUnique).not.toHaveBeenCalled();
    });

    it("fetches from DB when no cache hit", async () => {
      const progress = { userId: "u1", lessonId: 1, durationInSeconds: 60 };
      mockCache.get.mockResolvedValue(null);
      mockDb.userLessonProgress.findUnique.mockResolvedValue(progress as never);

      const result = await ProgressService.getByLessonId("u1", 1);
      expect(result).toEqual(progress);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("returns null when no progress exists", async () => {
      mockCache.get.mockResolvedValue(null);
      mockDb.userLessonProgress.findUnique.mockResolvedValue(null);

      const result = await ProgressService.getByLessonId("u1", 1);
      expect(result).toBeNull();
    });
  });

  describe("getByQuizId", () => {
    it("returns cached quiz progress when available", async () => {
      const progress = { userId: "u1", quizId: 1, score: 80 };
      mockCache.get.mockResolvedValue(progress);

      const result = await ProgressService.getByQuizId("u1", 1);
      expect(result).toEqual(progress);
      expect(mockDb.userQuizProgress.findUnique).not.toHaveBeenCalled();
    });

    it("fetches from DB when no cache hit", async () => {
      const progress = { userId: "u1", quizId: 1, score: 80 };
      mockCache.get.mockResolvedValue(null);
      mockDb.userQuizProgress.findUnique.mockResolvedValue(progress as never);

      const result = await ProgressService.getByQuizId("u1", 1);
      expect(result).toEqual(progress);
    });
  });

  describe("getAllLesson", () => {
    it("returns cached progress when available", async () => {
      const progress = [{ lessonId: 1, isCompleted: true, durationInSeconds: 300 }];
      mockCache.get.mockResolvedValue(progress);

      const result = await ProgressService.getAllLesson("u1");
      expect(result).toEqual(progress);
    });

    it("fetches from DB and caches when progress exists", async () => {
      const progress = [{ lessonId: 1, isCompleted: true, durationInSeconds: 300 }];
      mockCache.get.mockResolvedValue(null);
      mockDb.userLessonProgress.findMany.mockResolvedValue(progress as never);

      const result = await ProgressService.getAllLesson("u1");
      expect(result).toEqual(progress);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe("getAllQuiz", () => {
    it("returns cached quiz progress when available", async () => {
      const progress = [{ quizId: 1, isCompleted: true, score: 90 }];
      mockCache.get.mockResolvedValue(progress);

      const result = await ProgressService.getAllQuiz("u1");
      expect(result).toEqual(progress);
    });

    it("fetches from DB and caches when quiz progress exists", async () => {
      const progress = [{ quizId: 1, isCompleted: true, score: 90 }];
      mockCache.get.mockResolvedValue(null);
      mockDb.userQuizProgress.findMany.mockResolvedValue(progress as never);

      const result = await ProgressService.getAllQuiz("u1");
      expect(result).toEqual(progress);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe("resetAllLesson", () => {
    it("deletes cache and all lesson progress", async () => {
      mockDb.userLessonProgress.deleteMany.mockResolvedValue({ count: 5 } as never);

      await ProgressService.resetAllLesson("u1");
      expect(mockCache.delete).toHaveBeenCalled();
      expect(mockDb.userLessonProgress.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    });
  });

  describe("resetLesson", () => {
    it("deletes cache and specific lesson progress", async () => {
      mockDb.userLessonProgress.delete.mockResolvedValue({} as never);

      await ProgressService.resetLesson(1, "u1");
      expect(mockCache.delete).toHaveBeenCalled();
      expect(mockDb.userLessonProgress.delete).toHaveBeenCalledWith({
        where: { userId_lessonId: { lessonId: 1, userId: "u1" } },
      });
    });
  });

  describe("updateProgress", () => {
    it("marks as completed when duration >= required", async () => {
      mockDb.userLessonProgress.upsert.mockResolvedValue({} as never);

      await ProgressService.updateProgress({
        lessonId: 1,
        userId: "u1",
        durationInSeconds: 600,
        requiredDurationInSeconds: 300,
      });
      expect(mockDb.userLessonProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCompleted: true }),
          update: expect.objectContaining({ isCompleted: true }),
        }),
      );
    });

    it("does not mark as completed when duration < required", async () => {
      mockDb.userLessonProgress.upsert.mockResolvedValue({} as never);

      await ProgressService.updateProgress({
        lessonId: 1,
        userId: "u1",
        durationInSeconds: 100,
        requiredDurationInSeconds: 300,
      });
      expect(mockDb.userLessonProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCompleted: false }),
          update: expect.objectContaining({ isCompleted: false }),
        }),
      );
    });
  });

  describe("markComplete", () => {
    it("upserts progress as completed and updates cache", async () => {
      const progress = { userId: "u1", lessonId: 1, isCompleted: true, durationInSeconds: 300 };
      mockDb.userLessonProgress.upsert.mockResolvedValue(progress as never);

      const result = await ProgressService.markComplete({
        lessonId: 1,
        userId: "u1",
        requiredDurationInSeconds: 300,
      });
      expect(result).toEqual(progress);
      expect(mockDb.userLessonProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCompleted: true }),
          update: expect.objectContaining({ isCompleted: true }),
        }),
      );
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockCache.delete).toHaveBeenCalled();
    });
  });
});
