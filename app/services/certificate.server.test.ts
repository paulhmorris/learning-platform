import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/db.server", () => ({
  db: {
    certificateNumberAllocation: {
      count: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    certificate: {
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    preCertificationFormSubmission: {
      upsert: vi.fn(),
    },
    userCourse: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
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
import { MAX_ALLOCATION_RANGE_SIZE } from "~/lib/constants";

import { CertificateService } from "./certificate.server";

const mockDb = vi.mocked(db, true);

describe("CertificateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNextAllocationForCourse", () => {
    it("claims the returned allocation in a single statement", async () => {
      const allocation = { id: 1, number: "CERT-001", courseId: "course_1", isUsed: true };
      mockDb.$queryRaw.mockResolvedValue([allocation] as never);

      const result = await CertificateService.getNextAllocationForCourse("course_1");

      expect(result).toEqual(allocation);
      expect(mockDb.$queryRaw).toHaveBeenCalledOnce();
    });

    it("locks the row it claims so concurrent claims take different numbers", async () => {
      mockDb.$queryRaw.mockResolvedValue([] as never);

      await CertificateService.getNextAllocationForCourse("course_1");

      const sql = mockDb.$queryRaw.mock.calls[0]![0] as unknown as { strings: Array<string> };
      const statement = sql.strings.join("");
      expect(statement).toContain("FOR UPDATE SKIP LOCKED");
      // Plain string order would hand out 1, 10, 100, 11 for an unpadded range.
      expect(statement).toContain('ORDER BY LENGTH("number"), "number"');
    });

    it("returns null when no allocations are available", async () => {
      mockDb.$queryRaw.mockResolvedValue([] as never);

      const result = await CertificateService.getNextAllocationForCourse("course_1");
      expect(result).toBeNull();
    });

    it("returns null and captures exception on error", async () => {
      const error = new Error("Query error");
      mockDb.$queryRaw.mockRejectedValue(error as never);

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

  describe("getForRegenerationByUserAndCourse", () => {
    it("looks the user course up by the composite key", async () => {
      mockDb.userCourse.findUnique.mockResolvedValue(null as never);

      await CertificateService.getForRegenerationByUserAndCourse("user_1", "course_1");

      expect(mockDb.userCourse.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId_courseId: { userId: "user_1", courseId: "course_1" } } }),
      );
    });

    it("selects the certificate and form submission needed to re-render", async () => {
      mockDb.userCourse.findUnique.mockResolvedValue(null as never);

      await CertificateService.getForRegenerationByUserAndCourse("user_1", "course_1");

      const select = mockDb.userCourse.findUnique.mock.calls[0]![0].select!;
      expect(select.certificate).toBeTruthy();
      expect(select.preCertificationFormSubmission).toBeTruthy();
    });
  });

  describe("getForRegeneration", () => {
    it("looks the user course up by its id", async () => {
      mockDb.userCourse.findUnique.mockResolvedValue(null as never);

      await CertificateService.getForRegeneration(7);

      expect(mockDb.userCourse.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
      const select = mockDb.userCourse.findUnique.mock.calls[0]![0].select!;
      expect(select.certificate).toBeTruthy();
      expect(select.preCertificationFormSubmission).toBeTruthy();
    });
  });

  describe("amendFormSubmission", () => {
    it("updates the answers and clears isExported in one transaction", async () => {
      mockDb.$transaction.mockResolvedValue([] as never);

      await CertificateService.amendFormSubmission({ userCourseId: 5, formData: { city: "City of Lubbock" } });

      expect(mockDb.preCertificationFormSubmission.upsert).toHaveBeenCalledWith({
        where: { userCourseId: 5 },
        update: { formData: { city: "City of Lubbock" } },
        create: { userCourseId: 5, formData: { city: "City of Lubbock" } },
      });
      expect(mockDb.certificate.update).toHaveBeenCalledWith({
        where: { userCourseId: 5 },
        data: { isExported: null },
      });
      expect(mockDb.$transaction).toHaveBeenCalledOnce();
    });

    it("throws when the transaction fails so the caller does not queue a regeneration", async () => {
      mockDb.$transaction.mockRejectedValue(new Error("Transaction error") as never);

      await expect(
        CertificateService.amendFormSubmission({ userCourseId: 5, formData: {} }),
      ).rejects.toThrow("Transaction error");
    });
  });

  describe("createAllocationRange", () => {
    it("creates every number in the range, inclusive of both bounds", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 4 } as never);

      const result = await CertificateService.createAllocationRange({
        courseId: "course_1",
        start: "123000",
        end: "123003",
      });

      expect(mockDb.certificateNumberAllocation.createMany).toHaveBeenCalledWith({
        data: [
          { number: "123000", courseId: "course_1" },
          { number: "123001", courseId: "course_1" },
          { number: "123002", courseId: "course_1" },
          { number: "123003", courseId: "course_1" },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ requested: 4, created: 4, skipped: 0 });
    });

    it("stores numbers exactly as written, without padding", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 3 } as never);

      await CertificateService.createAllocationRange({ courseId: "course_1", start: "98", end: "100" });

      expect(mockDb.certificateNumberAllocation.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { number: "98", courseId: "course_1" },
            { number: "99", courseId: "course_1" },
            { number: "100", courseId: "course_1" },
          ],
        }),
      );
    });

    it("expands numbers past 2^53 exactly instead of rounding them together", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 3 } as never);

      await CertificateService.createAllocationRange({
        courseId: "course_1",
        start: "12345678901234567890",
        end: "12345678901234567892",
      });

      expect(mockDb.certificateNumberAllocation.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { number: "12345678901234567890", courseId: "course_1" },
            { number: "12345678901234567891", courseId: "course_1" },
            { number: "12345678901234567892", courseId: "course_1" },
          ],
        }),
      );
    });

    it("handles a single-number range", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 1 } as never);

      const result = await CertificateService.createAllocationRange({
        courseId: "course_1",
        start: "500",
        end: "500",
      });

      expect(result).toEqual({ requested: 1, created: 1, skipped: 0 });
    });

    it("reports numbers skipped because they already exist on another course", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 1 } as never);

      const result = await CertificateService.createAllocationRange({
        courseId: "course_1",
        start: "10",
        end: "12",
      });

      expect(result).toEqual({ requested: 3, created: 1, skipped: 2 });
    });

    it("splits a full-size range into chunked inserts", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 5000 } as never);

      const result = await CertificateService.createAllocationRange({
        courseId: "course_1",
        start: "1",
        end: String(MAX_ALLOCATION_RANGE_SIZE),
      });

      expect(mockDb.certificateNumberAllocation.createMany).toHaveBeenCalledTimes(2);
      expect(result.requested).toBe(MAX_ALLOCATION_RANGE_SIZE);
      expect(result.created).toBe(MAX_ALLOCATION_RANGE_SIZE);
    });

    it("keeps each insert under the Postgres bind-parameter limit", async () => {
      mockDb.certificateNumberAllocation.createMany.mockResolvedValue({ count: 5000 } as never);

      await CertificateService.createAllocationRange({
        courseId: "course_1",
        start: "1",
        end: String(MAX_ALLOCATION_RANGE_SIZE),
      });

      // Two bound values per row (number, courseId) against a 65,535 limit.
      for (const call of mockDb.certificateNumberAllocation.createMany.mock.calls) {
        expect(call[0]!.data).toHaveLength(5000);
      }
    });
  });

  describe("getAllocations", () => {
    beforeEach(() => {
      mockDb.$queryRaw.mockResolvedValue([
        { id: 1, number: "123000", isUsed: true, createdAt: new Date() },
        { id: 2, number: "123001", isUsed: false, createdAt: new Date() },
      ] as never);
      mockDb.certificateNumberAllocation.count.mockResolvedValue(2 as never);
      mockDb.certificate.findMany.mockResolvedValue([
        {
          number: "123000",
          issuedAt: new Date("2026-02-01"),
          isExported: null,
          userCourse: { userId: "user_1" },
        },
      ] as never);
    });

    it("joins each used allocation to the certificate that consumed it", async () => {
      const result = await CertificateService.getAllocations({ courseId: "course_1", page: 1, pageSize: 20 });

      expect(result.totalCount).toBe(2);
      expect(result.allocations[0]).toMatchObject({ number: "123000", claimedByUserId: "user_1" });
      expect(result.allocations[1]).toMatchObject({ number: "123001", claimedByUserId: null, issuedAt: null });
    });

    it("scopes the certificate join to the course, since numbers repeat across courses", async () => {
      await CertificateService.getAllocations({ courseId: "course_1", page: 1, pageSize: 20 });

      expect(mockDb.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userCourse: { courseId: "course_1" } }),
        }),
      );
    });

    it("sorts numerically rather than by string, so 10 does not come before 2", async () => {
      await CertificateService.getAllocations({ courseId: "course_1", page: 1, pageSize: 20 });

      const sql = mockDb.$queryRaw.mock.calls[0]![0] as unknown as { strings: Array<string> };
      expect(sql.strings.join("")).toContain('ORDER BY LENGTH("number")');
    });

    it("filters by status and search query", async () => {
      await CertificateService.getAllocations({
        courseId: "course_1",
        page: 1,
        pageSize: 20,
        status: "available",
        query: "1230",
      });

      const sql = mockDb.$queryRaw.mock.calls[0]![0] as unknown as {
        strings: Array<string>;
        values: Array<unknown>;
      };
      expect(sql.strings.join("")).toContain('"isUsed" =');
      expect(sql.values).toContain("%1230%");
      // The count is still a typed Prisma query and has to filter identically.
      expect(mockDb.certificateNumberAllocation.count).toHaveBeenCalledWith({
        where: { courseId: "course_1", isUsed: false, number: { contains: "1230" } },
      });
    });

    it("offsets by page", async () => {
      await CertificateService.getAllocations({ courseId: "course_1", page: 3, pageSize: 20 });

      const sql = mockDb.$queryRaw.mock.calls[0]![0] as unknown as { values: Array<unknown> };
      expect(sql.values).toContain(40);
      expect(sql.values).toContain(20);
    });
  });

  describe("deleteUnusedAllocationRange", () => {
    it("deletes only unused numbers in the range, scoped to the course", async () => {
      mockDb.certificateNumberAllocation.deleteMany.mockResolvedValue({ count: 3 } as never);

      const result = await CertificateService.deleteUnusedAllocationRange({
        courseId: "course_1",
        start: "1",
        end: "3",
      });

      expect(mockDb.certificateNumberAllocation.deleteMany).toHaveBeenCalledWith({
        where: { courseId: "course_1", isUsed: false, number: { in: ["1", "2", "3"] } },
      });
      expect(result).toEqual({ requested: 3, deleted: 3 });
    });

    it("reports how many were kept because they were claimed", async () => {
      mockDb.certificateNumberAllocation.deleteMany.mockResolvedValue({ count: 2 } as never);

      const result = await CertificateService.deleteUnusedAllocationRange({
        courseId: "course_1",
        start: "1",
        end: "5",
      });

      expect(result).toEqual({ requested: 5, deleted: 2 });
    });
  });

  describe("deleteUnusedAllocation", () => {
    it("scopes the delete to the course and to unused numbers only", async () => {
      mockDb.certificateNumberAllocation.deleteMany.mockResolvedValue({ count: 1 } as never);

      await expect(CertificateService.deleteUnusedAllocation({ id: 9, courseId: "course_1" })).resolves.toBe(true);
      expect(mockDb.certificateNumberAllocation.deleteMany).toHaveBeenCalledWith({
        where: { id: 9, courseId: "course_1", isUsed: false },
      });
    });

    it("returns false when the number was already claimed", async () => {
      mockDb.certificateNumberAllocation.deleteMany.mockResolvedValue({ count: 0 } as never);

      await expect(CertificateService.deleteUnusedAllocation({ id: 9, courseId: "course_1" })).resolves.toBe(false);
    });
  });

  describe("getAllocationSummary", () => {
    it("derives all three counts from a single grouped query", async () => {
      mockDb.certificateNumberAllocation.groupBy.mockResolvedValue([
        { isUsed: true, _count: { _all: 30 } },
        { isUsed: false, _count: { _all: 70 } },
      ] as never);

      await expect(CertificateService.getAllocationSummary("course_1")).resolves.toEqual({
        total: 100,
        used: 30,
        available: 70,
      });
      expect(mockDb.certificateNumberAllocation.groupBy).toHaveBeenCalledOnce();
    });

    it("reports zeros when the course has no allocations", async () => {
      mockDb.certificateNumberAllocation.groupBy.mockResolvedValue([] as never);

      await expect(CertificateService.getAllocationSummary("course_1")).resolves.toEqual({
        total: 0,
        used: 0,
        available: 0,
      });
    });
  });

  describe("updateS3Key", () => {
    it("stores the new key on the certificate", async () => {
      mockDb.certificate.update.mockResolvedValue({} as never);

      await CertificateService.updateS3Key(3, "certificates/a/b.png");

      expect(mockDb.certificate.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { s3Key: "certificates/a/b.png" },
      });
    });
  });
});
