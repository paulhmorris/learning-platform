import { Prisma } from "@prisma/client";

import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { MAX_ALLOCATION_RANGE_SIZE } from "~/lib/constants";

const logger = createLogger("CertificateService");

const ALLOCATION_INSERT_CHUNK_SIZE = 5_000;

/**
 * Expands an inclusive range into the number strings stored on the allocation rows. Leading zeros are
 * rejected upstream, so every number has exactly one written form and "1"–"100" stores "1, 2, … 100".
 *
 * BigInt, not Number: state-issued numbers run past 2^53, where "12345678901234567890" and
 * "…891" would round to the same string and collapse a range into one row.
 */
function buildAllocationNumbers(start: string, end: string) {
  const startNumber = BigInt(start);
  const endNumber = BigInt(end);

  if (endNumber < startNumber) {
    throw new Error("The last certificate number must be greater than or equal to the first");
  }

  const count = endNumber - startNumber + 1n;
  if (count > BigInt(MAX_ALLOCATION_RANGE_SIZE)) {
    throw new Error(`Ranges are limited to ${MAX_ALLOCATION_RANGE_SIZE.toLocaleString()} numbers at a time`);
  }

  return Array.from({ length: Number(count) }, (_, i) => (startNumber + BigInt(i)).toString());
}

type CertificateCreateArgs = {
  number: string;
  userCourseId: number;
  s3Key: string;
};

const regenerationSelect = {
  id: true,
  userId: true,
  courseId: true,
  completedAt: true,
  certificate: { select: { id: true, number: true, s3Key: true, issuedAt: true, isExported: true } },
  preCertificationFormSubmission: { select: { formData: true, updatedAt: true } },
} satisfies Prisma.UserCourseSelect;

export const CertificateService = {
  async getUnexported() {
    return db.certificate.findMany({
      select: {
        id: true,
        number: true,
        userCourseId: true,
        issuedAt: true,
        userCourse: {
          select: {
            id: true,
            completedAt: true,
            preCertificationFormSubmission: {
              select: {
                formData: true,
              },
            },
          },
        },
      },
      where: { isExported: null },
    });
  },

  /** Certificate, form answers, and completion dates needed to re-render an already-issued certificate. */
  async getForRegeneration(userCourseId: number) {
    return db.userCourse.findUnique({ where: { id: userCourseId }, select: regenerationSelect });
  },

  async getForRegenerationByUserAndCourse(userId: string, courseId: string) {
    return db.userCourse.findUnique({ where: { userId_courseId: { userId, courseId } }, select: regenerationSelect });
  },

  /**
   * Overwrite a student's pre-certification answers after the certificate was issued. Clearing
   * isExported re-queues the certificate for the next state data export so the corrected values
   * are sent through. Upserts because a certificate can outlive its submission row, and repairing
   * that case is exactly what an admin comes here to do.
   */
  async amendFormSubmission(data: { userCourseId: number; formData: Prisma.JsonObject }) {
    await db.$transaction([
      db.preCertificationFormSubmission.upsert({
        where: { userCourseId: data.userCourseId },
        update: { formData: data.formData },
        create: { userCourseId: data.userCourseId, formData: data.formData },
      }),
      db.certificate.update({
        where: { userCourseId: data.userCourseId },
        data: { isExported: null },
      }),
    ]);
  },

  async updateS3Key(certificateId: number, s3Key: string) {
    await db.certificate.update({ where: { id: certificateId }, data: { s3Key } });
  },

  async markExported(certificateIds: Array<number>) {
    await db.certificate.updateMany({
      where: { id: { in: certificateIds } },
      data: { isExported: new Date() },
    });
  },

  /**
   * Claims the next unused number for a course. A read-then-write would let two simultaneous claims
   * take the same row and issue one number to two students, so the row is selected and marked used
   * in a single statement: FOR UPDATE SKIP LOCKED makes concurrent callers take different rows.
   *
   * Ordered by length before value because the numbers are stored as strings — plain string order
   * would hand out 1, 10, 100, 11 for a 1–100 range.
   */
  async getNextAllocationForCourse(courseId: string) {
    try {
      logger.debug(`Getting certificate number allocation for course ${courseId}`);
      const claimed = await db.$queryRaw<
        Array<{ id: number; number: string; isUsed: boolean; courseId: string }>
      >(Prisma.sql`
        UPDATE "CertificateNumberAllocation"
        SET "isUsed" = true, "updatedAt" = NOW()
        WHERE "id" = (
          SELECT "id" FROM "CertificateNumberAllocation"
          WHERE "courseId" = ${courseId} AND "isUsed" = false
          ORDER BY LENGTH("number"), "number"
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "number", "isUsed", "courseId"
      `);

      const allocation = claimed.at(0);
      if (!allocation) {
        logger.error(`No allocations were found for course ${courseId}. Please add more.`);
        return null;
      }

      logger.info(`Claimed allocation ${allocation.id} (${allocation.number}) for course ${courseId}`);
      return allocation;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "Unknown error");
      return null;
    }
  },

  async getRemainingAllocationsCount(courseId: string) {
    return db.certificateNumberAllocation.count({ where: { courseId, isUsed: false } });
  },

  /**
   * Adds every number in an inclusive range to a course. Numbers are unique within a course, so any
   * the course already has are skipped rather than failing the whole batch.
   */
  async createAllocationRange(data: { courseId: string; start: string; end: string }) {
    const numbers = buildAllocationNumbers(data.start, data.end);

    // Sequential rather than parallel, so a large range can't saturate the serverless connection
    // pool with simultaneous inserts.
    let created = 0;
    for (let i = 0; i < numbers.length; i += ALLOCATION_INSERT_CHUNK_SIZE) {
      // eslint-disable-next-line no-await-in-loop
      const result = await db.certificateNumberAllocation.createMany({
        data: numbers.slice(i, i + ALLOCATION_INSERT_CHUNK_SIZE).map((number) => ({ number, courseId: data.courseId })),
        skipDuplicates: true,
      });
      created += result.count;
    }

    logger.info(`Created ${created} of ${numbers.length} certificate allocations for course ${data.courseId}`, {
      courseId: data.courseId,
      start: data.start,
      end: data.end,
    });

    return { requested: numbers.length, created, skipped: numbers.length - created };
  },

  async getAllocationSummary(courseId: string) {
    const grouped = await db.certificateNumberAllocation.groupBy({
      by: ["isUsed"],
      where: { courseId },
      _count: { _all: true },
    });

    const used = grouped.find((group) => group.isUsed)?._count._all ?? 0;
    const available = grouped.find((group) => !group.isUsed)?._count._all ?? 0;
    return { total: used + available, used, available };
  },

  /**
   * A page of a course's allocations, each joined to the issued certificate that consumed it.
   * Allocations and certificates share a number but have no foreign key, so the join is done here.
   */
  async getAllocations(params: {
    courseId: string;
    page: number;
    pageSize: number;
    query?: string;
    status?: "used" | "available";
    order?: "asc" | "desc";
  }) {
    const where: Prisma.CertificateNumberAllocationWhereInput = {
      courseId: params.courseId,
      ...(params.status ? { isUsed: params.status === "used" } : {}),
      ...(params.query ? { number: { contains: params.query } } : {}),
    };

    // Ordered by length before value: the numbers are stored as strings, so plain string order
    // would list 1, 10, 100, 11. Leading zeros are rejected on the way in, which makes that pair
    // exactly numeric order.
    const direction = params.order === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
    const conditions = [Prisma.sql`"courseId" = ${params.courseId}`];
    if (params.status) {
      conditions.push(Prisma.sql`"isUsed" = ${params.status === "used"}`);
    }
    if (params.query) {
      conditions.push(Prisma.sql`"number" LIKE ${`%${params.query}%`}`);
    }

    const [allocations, totalCount] = await Promise.all([
      db.$queryRaw<Array<{ id: number; number: string; isUsed: boolean; createdAt: Date }>>(Prisma.sql`
        SELECT "id", "number", "isUsed", "createdAt"
        FROM "CertificateNumberAllocation"
        WHERE ${Prisma.join(conditions, " AND ")}
        ORDER BY LENGTH("number") ${direction}, "number" ${direction}
        LIMIT ${params.pageSize} OFFSET ${(params.page - 1) * params.pageSize}
      `),
      db.certificateNumberAllocation.count({ where }),
    ]);

    // Numbers are only unique within a course, so the join must be scoped to this course too.
    const certificates = await db.certificate.findMany({
      where: {
        number: { in: allocations.map((a) => a.number) },
        userCourse: { courseId: params.courseId },
      },
      select: { number: true, issuedAt: true, isExported: true, userCourse: { select: { userId: true } } },
    });
    // One number should map to one certificate. If it doesn't, the number was issued twice and a Map
    // would quietly show whichever row came back last, hiding it on the page built to catch it.
    const certificatesByNumber = new Map(certificates.map((c) => [c.number, c]));
    const duplicatedNumbers = certificates
      .map((c) => c.number)
      .filter((number, i, all) => all.indexOf(number) !== i);

    if (duplicatedNumbers.length > 0) {
      const numbers = [...new Set(duplicatedNumbers)];
      logger.error(`Course ${params.courseId} has certificates sharing a number`, {
        courseId: params.courseId,
        numbers,
      });
      Sentry.captureMessage("Duplicate certificate numbers issued for a course", {
        extra: { courseId: params.courseId, numbers },
        level: "error",
      });
    }

    return {
      totalCount,
      allocations: allocations.map((allocation) => {
        const certificate = certificatesByNumber.get(allocation.number);
        return {
          id: allocation.id,
          number: allocation.number,
          isUsed: allocation.isUsed,
          createdAt: allocation.createdAt,
          claimedByUserId: certificate?.userCourse.userId ?? null,
          issuedAt: certificate?.issuedAt ?? null,
          isExported: certificate?.isExported ?? null,
          isDuplicated: duplicatedNumbers.includes(allocation.number),
        };
      }),
    };
  },

  /** Removes every unused number in an inclusive range. */
  async deleteUnusedAllocationRange(data: { courseId: string; start: string; end: string }) {
    const numbers = buildAllocationNumbers(data.start, data.end);

    const { count } = await db.certificateNumberAllocation.deleteMany({
      where: { courseId: data.courseId, isUsed: false, number: { in: numbers } },
    });

    logger.info(`Deleted ${count} unused certificate allocations for course ${data.courseId}`, {
      courseId: data.courseId,
      start: data.start,
      end: data.end,
    });

    return { requested: numbers.length, deleted: count };
  },

  /** Only unused numbers can be removed; a used one belongs to a certificate that has been issued. */
  async deleteUnusedAllocation(data: { id: number; courseId: string }) {
    const { count } = await db.certificateNumberAllocation.deleteMany({
      where: { id: data.id, courseId: data.courseId, isUsed: false },
    });
    return count > 0;
  },

  async createAndUpdateCourse(data: CertificateCreateArgs) {
    try {
      const updatedCourseAndCertifiate = await db.userCourse.update({
        where: { id: data.userCourseId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
          certificate: {
            create: {
              s3Key: data.s3Key,
              number: data.number,
              issuedAt: new Date(),
            },
          },
        },
        select: {
          id: true,
          // The dates the certificate is rendered with have to be the persisted ones, so a later
          // regeneration reads back exactly what was printed.
          completedAt: true,
          certificate: {
            select: {
              number: true,
              issuedAt: true,
            },
          },
        },
      });
      return updatedCourseAndCertifiate;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  },

  // Undo createAndUpdateCourse + getNextAllocationForCourse when a later step (image generation,
  // upload) fails, so the allocation and certificate slot are freed up for a retry.
  async rollbackClaim(data: { userCourseId: number; allocationId: number }) {
    try {
      await db.$transaction([
        db.certificate.delete({ where: { userCourseId: data.userCourseId } }),
        db.certificateNumberAllocation.update({ where: { id: data.allocationId }, data: { isUsed: false } }),
      ]);
      logger.info("Rolled back certificate claim", data);
    } catch (error) {
      Sentry.captureException(error, { extra: data });
      logger.error(error instanceof Error ? error.message : "Failed to roll back certificate claim", {
        ...data,
      });
    }
  },

  // Same as rollbackClaim, but for when the certificate record was never created
  async releaseAllocation(allocationId: number) {
    try {
      await db.certificateNumberAllocation.update({ where: { id: allocationId }, data: { isUsed: false } });
      logger.info("Released certificate allocation", { allocationId });
    } catch (error) {
      Sentry.captureException(error, { extra: { allocationId } });
      logger.error(error instanceof Error ? error.message : "Failed to release certificate allocation", {
        allocationId,
      });
    }
  },
};
