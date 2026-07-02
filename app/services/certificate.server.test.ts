import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/db.server", () => ({
  db: {
    certificateNumberAllocation: {
      count: vi.fn(),
      update: vi.fn(),
    },
    certificate: {
      delete: vi.fn(),
    },
    userCourse: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
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

import { CertificateService } from "./certificate.server";

const mockDb = vi.mocked(db, true);

describe("CertificateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNextAllocationForCourse", () => {
    it("returns the next allocation via transaction", async () => {
      const allocation = { id: 1, number: "CERT-001", courseId: "course_1", isUsed: false };
      mockDb.$transaction.mockImplementation(async (fn) => {
        // Simulate the transaction callback
        return fn({
          certificateNumberAllocation: {
            findFirst: vi.fn().mockResolvedValue(allocation),
            update: vi.fn().mockResolvedValue({ ...allocation, isUsed: true }),
          },
        } as never);
      });

      const result = await CertificateService.getNextAllocationForCourse("course_1");
      expect(result).toEqual(allocation);
    });

    it("returns null when no allocations are available", async () => {
      mockDb.$transaction.mockImplementation(async (fn) => {
        return fn({
          certificateNumberAllocation: {
            findFirst: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        } as never);
      });

      const result = await CertificateService.getNextAllocationForCourse("course_1");
      expect(result).toBeNull();
    });

    it("returns null and captures exception on error", async () => {
      const error = new Error("Transaction error");
      mockDb.$transaction.mockRejectedValue(error);

      const result = await CertificateService.getNextAllocationForCourse("course_1");
      expect(result).toBeNull();
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("getRemainingAllocationsCount", () => {
    it("returns count of unused allocations", async () => {
      mockDb.certificateNumberAllocation.count.mockResolvedValue(10);
      const count = await CertificateService.getRemainingAllocationsCount("course_1");
      expect(count).toBe(10);
      expect(mockDb.certificateNumberAllocation.count).toHaveBeenCalledWith({
        where: { courseId: "course_1", isUsed: false },
      });
    });
  });

  describe("createAndUpdateCourse", () => {
    it("updates user course and creates certificate", async () => {
      const result = { id: 1, certificate: { number: "CERT-001" } };
      mockDb.userCourse.update.mockResolvedValue(result as never);

      const data = { number: "CERT-001", userCourseId: 1, s3Key: "certs/cert.pdf" };
      const updated = await CertificateService.createAndUpdateCourse(data);
      expect(updated).toEqual(result);
      expect(mockDb.userCourse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            isCompleted: true,
            certificate: expect.objectContaining({
              create: expect.objectContaining({ s3Key: "certs/cert.pdf", number: "CERT-001" }),
            }),
          }),
        }),
      );
    });

    it("captures exception and rethrows on error", async () => {
      const error = new Error("DB error");
      mockDb.userCourse.update.mockRejectedValue(error);

      await expect(
        CertificateService.createAndUpdateCourse({ number: "X", userCourseId: 1, s3Key: "k" }),
      ).rejects.toThrow("DB error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("rollbackClaim", () => {
    it("deletes the certificate and frees the allocation via a transaction", async () => {
      mockDb.$transaction.mockResolvedValue([{}, {}]);

      await CertificateService.rollbackClaim({ userCourseId: 1, allocationId: 2 });

      expect(mockDb.$transaction).toHaveBeenCalledWith(expect.arrayContaining([]));
      expect(vi.mocked(mockDb.$transaction).mock.calls[0][0]).toHaveLength(2);
      expect(mockDb.certificate.delete).toHaveBeenCalledWith({ where: { userCourseId: 1 } });
      expect(mockDb.certificateNumberAllocation.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { isUsed: false },
      });
    });

    it("logs and captures the exception instead of throwing when the transaction fails", async () => {
      const error = new Error("Transaction error");
      mockDb.$transaction.mockRejectedValue(error);

      await expect(CertificateService.rollbackClaim({ userCourseId: 1, allocationId: 2 })).resolves.toBeUndefined();
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error, {
        extra: { userCourseId: 1, allocationId: 2 },
      });
    });
  });

  describe("releaseAllocation", () => {
    it("marks the allocation as unused", async () => {
      mockDb.certificateNumberAllocation.update.mockResolvedValue({} as never);

      await CertificateService.releaseAllocation(2);

      expect(mockDb.certificateNumberAllocation.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { isUsed: false },
      });
    });

    it("logs and captures the exception instead of throwing when the update fails", async () => {
      const error = new Error("Update error");
      mockDb.certificateNumberAllocation.update.mockRejectedValue(error);

      await expect(CertificateService.releaseAllocation(2)).resolves.toBeUndefined();
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error, { extra: { allocationId: 2 } });
    });
  });
});
