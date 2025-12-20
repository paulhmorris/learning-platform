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
          logger.warn(`No allocations were found for course ${courseId}. Please add more.`);
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
      });
      return updatedCourseAndCertifiate;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "Unknown error", { error });
      throw error;
    }
  },
};
