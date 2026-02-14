import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/cms.server", () => ({
  cms: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("~/integrations/db.server", () => ({
  db: {
    userQuizProgress: {
      deleteMany: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
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
    quizProgress: (userId: string, quizId: number) => `progress:quiz:${userId}:${quizId}`,
    quizProgressAll: (userId: string) => `progress:quiz:all:${userId}`,
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { CacheService } from "~/services/cache.server";

import { QuizService } from "./quiz.server";

const mockCms = vi.mocked(cms, true);
const mockDb = vi.mocked(db, true);
const mockCache = vi.mocked(CacheService, true);

describe("QuizService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getById", () => {
    it("delegates to cms.findOne with quiz populate", async () => {
      const quiz = { data: { id: 1, attributes: { title: "Quiz 1" } } };
      mockCms.findOne.mockResolvedValue(quiz as never);

      const result = await QuizService.getById(1);
      expect(result).toEqual(quiz);
      expect(mockCms.findOne).toHaveBeenCalledWith("quizzes", 1, expect.any(Object));
    });

    it("propagates CMS errors", async () => {
      const error = new Error("CMS error");
      mockCms.findOne.mockRejectedValue(error);

      await expect(QuizService.getById(1)).rejects.toThrow("CMS error");
    });
  });

  describe("getCorrectAnswers", () => {
    it("delegates to cms.findOne with correct answer populate", async () => {
      const quiz = { data: { id: 1 } };
      mockCms.findOne.mockResolvedValue(quiz as never);

      const result = await QuizService.getCorrectAnswers(1);
      expect(result).toEqual(quiz);
    });
  });

  describe("getAll", () => {
    it("delegates to cms.find", async () => {
      const quizzes = { data: [{ id: 1 }, { id: 2 }], meta: {} };
      mockCms.find.mockResolvedValue(quizzes as never);

      const result = await QuizService.getAll();
      expect(result).toEqual(quizzes);
    });
  });

  describe("resetAllProgress", () => {
    it("deletes cache and all quiz progress", async () => {
      mockCache.delete.mockResolvedValue(undefined);
      mockDb.userQuizProgress.deleteMany.mockResolvedValue({ count: 3 } as never);

      await QuizService.resetAllProgress("u1");
      expect(mockCache.delete).toHaveBeenCalled();
      expect(mockDb.userQuizProgress.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    });
  });

  describe("resetProgress", () => {
    it("deletes cache and specific quiz progress in parallel", async () => {
      mockCache.delete.mockResolvedValue(undefined);
      mockDb.userQuizProgress.delete.mockResolvedValue({} as never);

      await QuizService.resetProgress(1, "u1");
      expect(mockCache.delete).toHaveBeenCalled();
      expect(mockDb.userQuizProgress.delete).toHaveBeenCalledWith({
        where: { userId_quizId: { quizId: 1, userId: "u1" } },
      });
    });
  });

  describe("updateProgress", () => {
    it("marks as completed when score >= passingScore", async () => {
      mockDb.userQuizProgress.upsert.mockResolvedValue({} as never);

      await QuizService.updateProgress({ quizId: 1, userId: "u1", score: 90, passingScore: 80 });
      expect(mockDb.userQuizProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCompleted: true, score: 90 }),
          update: expect.objectContaining({ isCompleted: true, score: 90 }),
        }),
      );
    });

    it("does not mark as completed when score < passingScore", async () => {
      mockDb.userQuizProgress.upsert.mockResolvedValue({} as never);

      await QuizService.updateProgress({ quizId: 1, userId: "u1", score: 50, passingScore: 80 });
      expect(mockDb.userQuizProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCompleted: false }),
          update: expect.objectContaining({ isCompleted: false }),
        }),
      );
    });
  });

  describe("markAsPassed", () => {
    it("upserts quiz progress as completed", async () => {
      mockDb.userQuizProgress.upsert.mockResolvedValue({} as never);

      await QuizService.markAsPassed(1, "u1", 95);
      expect(mockDb.userQuizProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_quizId: { quizId: 1, userId: "u1" } },
          create: { quizId: 1, userId: "u1", score: 95, isCompleted: true },
          update: { score: 95, isCompleted: true },
        }),
      );
    });

    it("propagates DB errors", async () => {
      const error = new Error("DB error");
      mockDb.userQuizProgress.upsert.mockRejectedValue(error);

      await expect(QuizService.markAsPassed(1, "u1", 95)).rejects.toThrow("DB error");
    });
  });
});
