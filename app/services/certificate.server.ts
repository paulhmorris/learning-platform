import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { isZeroPadded } from "~/lib/utils";

const logger = createLogger("CertificateService");

const ALLOCATION_INSERT_CHUNK_SIZE = 5_000;

/**
 * Expands an inclusive range into the exact number strings stored on the allocation rows. Padding is
 * taken from what the admin typed rather than inferred: "001"–"100" is fixed-width and stores
 * "001, 002, … 100", while "1"–"100" stores "1, 2, … 100". A padded bound therefore has to be the
 * same width as the other one, or the intended width would be a guess.
 */
function buildAllocationNumbers(start: string, end: string) {
  const isFixedWidth = isZeroPadded(start) || isZeroPadded(end);

  if (isFixedWidth && start.length !== end.length) {
    throw new Error("Zero-padded certificate number bounds must have the same number of digits");
  }

  const width = isFixedWidth ? start.length : 0;
  const startNumber = Number(start);
  const endNumber = Number(end);
  return Array.from({ length: endNumber - startNumber + 1 }, (_, i) =>
    String(startNumber + i).padStart(width, "0"),
  );
}

type CertificateCreateArgs = {
  number: string;
  userCourseId: number;
  s3Key: string;
};

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

  async markExported(certificateIds: Array<number>) {
    await db.certificate.updateMany({
      where: { id: { in: certificateIds } },
      data: { isExported: new Date() },
    });
  },

  // TODO: possible race conditions here if two people hit this at the same time?
  async getNextAllocationForCourse(courseId: string) {
    try {
      const allocation = await db.$transaction(async (tx) => {
        logger.debug(`Getting certificate number allocation for course ${courseId}`);
        const nextAllocation = await tx.certificateNumberAllocation.findFirst({
          where: { courseId, isUsed: false },
          orderBy: { number: "asc" },
        });

        if (!nextAllocation) {
          logger.error(`No allocations were found for course ${courseId}. Please add more.`);
          return null;
        }

        logger.info(`Found allocation for course ${courseId}, marking as used`);
        await tx.certificateNumberAllocation.update({
          where: { id: nextAllocation.id },
          data: { isUsed: true },
        });
        return nextAllocation;
      });
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

    const [allocations, totalCount] = await Promise.all([
      db.certificateNumberAllocation.findMany({
        where,
        orderBy: { number: params.order ?? "asc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: { id: true, number: true, isUsed: true, createdAt: true },
      }),
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
    const certificatesByNumber = new Map(certificates.map((c) => [c.number, c]));

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
        };
      }),
    };
  },

  /**
   * Removes every unused number in an inclusive range. Numbers are matched as exact strings, so a
   * range of "1"–"100" will not touch allocations stored as "001"–"100".
   */
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
          certificate: {
            select: {
              number: true,
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
