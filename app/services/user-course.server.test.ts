import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/db.server", () => ({
  db: {
    userCourse: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";

import { UserCourseService } from "./user-course.server";

const mockDb = vi.mocked(db, true);

describe("UserCourseService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllByUserId", () => {
    it("returns all user courses", async () => {
      const courses = [{ id: 1, courseId: "c1", isCompleted: false }];
      mockDb.userCourse.findMany.mockResolvedValue(courses as never);

      const result = await UserCourseService.getAllByUserId("u1");
      expect(result).toEqual(courses);
      expect(mockDb.userCourse.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
    });

    it("propagates DB errors", async () => {
      const error = new Error("DB error");
      mockDb.userCourse.findMany.mockRejectedValue(error);

      await expect(UserCourseService.getAllByUserId("u1")).rejects.toThrow("DB error");
    });
  });

  describe("getByUserIdAndCourseIdWithCertificate", () => {
    it("returns user course with certificate", async () => {
      const course = {
        isCompleted: true,
        completedAt: new Date(),
        certificate: { id: 1, issuedAt: new Date(), s3Key: "cert.pdf" },
      };
      mockDb.userCourse.findUnique.mockResolvedValue(course as never);

      const result = await UserCourseService.getByUserIdAndCourseIdWithCertificate("u1", "c1");
      expect(result).toEqual(course);
      expect(mockDb.userCourse.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_courseId: { userId: "u1", courseId: "c1" } },
        }),
      );
    });

    it("returns null when no course found", async () => {
      mockDb.userCourse.findUnique.mockResolvedValue(null);

      const result = await UserCourseService.getByUserIdAndCourseIdWithCertificate("u1", "c1");
      expect(result).toBeNull();
    });
  });

  describe("enrollUser", () => {
    it("creates a user course enrollment", async () => {
      const enrollment = { id: 1, userId: "u1", courseId: "c1" };
      mockDb.userCourse.create.mockResolvedValue(enrollment as never);

      const result = await UserCourseService.enrollUser("u1", "c1");
      expect(result).toEqual(enrollment);
      expect(mockDb.userCourse.create).toHaveBeenCalledWith({
        data: { userId: "u1", courseId: "c1" },
      });
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("Duplicate enrollment");
      mockDb.userCourse.create.mockRejectedValue(error);

      await expect(UserCourseService.enrollUser("u1", "c1")).rejects.toThrow("Duplicate enrollment");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });
});
