import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("CertificateService");

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
      logger.error(error instanceof Error ? error.message : "Unknown error", { error });
      return null;
    }
  },

  async getRemainingAllocationsCount(courseId: string) {
    return db.certificateNumberAllocation.count({ where: { courseId, isUsed: false } });
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
      logger.error(error instanceof Error ? error.message : "Unknown error", { error });
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
        error,
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
        error,
        allocationId,
      });
    }
  },
};
