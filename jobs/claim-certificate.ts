import { logger, task } from "@trigger.dev/sdk/v3";

import { SERVER_CONFIG } from "~/config.server";
import AllocationsLowInternalEmail from "~/emails/allocations-low-internal";
import CertificateGenerationFailureInternalEmail from "~/emails/certificate-generation-failure-internal";
import CertificateIssueEmail from "~/emails/certificate-issue";
import CertificateReadyEmail from "~/emails/certificate-ready";
import { Bucket } from "~/integrations/bucket.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";
import { CourseService } from "~/services/course.server";
import { UserCourseService } from "~/services/user-course.server";
import { UserService } from "~/services/user.server";

import { ASSET_BASE_URL, certificateMap, formatCertificateDate } from "./certificate-generation";

const INTERNAL_EMAIL = `events@${SERVER_CONFIG.emailFromDomain}`;
const ALLOCATION_LOW_THRESHOLD = 10;

type JobPayload = {
  userId: string;
  courseId: string;
  courseName: string;
};

export const claimCertificateJob = task({
  id: "claim-certificate",
  run: async (payload: JobPayload) => {
    let user;
    try {
      user = await UserService.getById(payload.userId);
    } catch (error) {
      Sentry.captureException(error, { extra: { userId: payload.userId } });
      logger.error("Error fetching user for certificate claim", { error, userId: payload.userId });
      throw new Error("Error fetching user for certificate claim", { cause: error });
    }

    if (!user) {
      logger.error("User not found in Clerk", { userId: payload.userId });
      throw new Error("User not found in Clerk");
    }

    if (!user.email) {
      logger.error("User does not have an email address", { userId: payload.userId });
      throw new Error("User does not have an email address");
    }

    logger.info("User found", user);

    try {
      await CourseService.getById(payload.courseId);
    } catch (error) {
      Sentry.captureException(error, { extra: { courseId: payload.courseId } });
      logger.error("Course not found for certificate claim", { error, courseId: payload.courseId });
      throw new Error("Course not found for certificate claim", { cause: error });
    }

    const userCourses = await UserCourseService.getAllByUserId(user.id);
    const thisUserCourse = userCourses.find((c) => c.courseId === payload.courseId);
    if (!thisUserCourse) {
      logger.error("User has not completed this course", user);
      throw new Error("User has not completed this course");
    }

    // Check if certificate has already been claimed
    if (thisUserCourse.certificate) {
      logger.info("Certificate already claimed. Sending another email.", user);
      const { messageId } = await EmailService.send({
        from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "View Your Certificate!",
        react: CertificateReadyEmail({
          firstName: user.firstName,
          courseName: payload.courseName,
          downloadUrl: `${ASSET_BASE_URL}/${thisUserCourse.certificate.s3Key}`,
        }),
      });
      logger.info(`Certificate resend email sent with message ID ${messageId}`);
      return;
    }

    // Find the certificate config for this course (business checks + canvas generator)
    const courseConfig = certificateMap.find((c) => c.courseIds.includes(payload.courseId));

    // Run business checks if defined for this course
    if (courseConfig?.businessChecksFunction) {
      const isReady = await courseConfig.businessChecksFunction(thisUserCourse.id);
      if (!isReady) {
        logger.error("Certificate generation function is lacking requirements", { userCourseId: thisUserCourse.id });
        throw new Error("Certificate generation function is lacking requirements");
      }
    }

    // Pull certificate allocation and create certificate entry
    const allocation = await CertificateService.getNextAllocationForCourse(payload.courseId);
    if (!allocation) {
      logger.error("No allocations available");
      Sentry.captureMessage("No certificate allocations available", {
        extra: { courseId: payload.courseId, userId: payload.userId },
      });
      const { messageId } = await EmailService.send({
        from: `${payload.courseName} <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "There was an issue creating your certificate!",
        react: CertificateIssueEmail({
          firstName: user.firstName,
          courseName: payload.courseName,
        }),
      });
      logger.warn(`Certificate issue email sent with message ID ${messageId}`);
      return;
    }

    logger.info(`Found available allocation with id ${allocation.id} and number ${allocation.number}`);

    // Check remaining allocations and alert if running low
    const remaining = await CertificateService.getRemainingAllocationsCount(payload.courseId);
    if (remaining <= ALLOCATION_LOW_THRESHOLD) {
      await EmailService.send({
        to: INTERNAL_EMAIL,
        from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        subject:
          remaining === 0
            ? `🚨 Certificate allocations exhausted for ${payload.courseName}`
            : `⚠️ Certificate allocations low for ${payload.courseName} (${remaining} remaining)`,
        react: AllocationsLowInternalEmail({
          courseName: payload.courseName,
          courseId: payload.courseId,
          remaining,
        }),
      }).catch((err) => logger.warn("Failed to send allocations low email", { error: err }));
    }

    const dateForKey = new Date();
    const year = dateForKey.getFullYear();
    const month = dateForKey.getMonth() + 1;
    const day = dateForKey.getDate();
    const safeCourseName = payload.courseName
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .toLowerCase();
    const key = `certificates/${safeCourseName}/${year}/${month}/${day}/${user.id}-${Date.now()}.png`;

    let courseWithCertificate;
    try {
      courseWithCertificate = await CertificateService.createAndUpdateCourse({
        s3Key: key,
        number: allocation.number,
        userCourseId: thisUserCourse.id,
      });
      logger.info(
        "User course marked complete and certificate linked. Beginning certificate creation...",
        courseWithCertificate,
      );
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "Failed to create certificate record", {
        error,
        userCourseId: thisUserCourse.id,
      });
      await CertificateService.releaseAllocation(allocation.id);
      return;
    }

    const certificateNumber = courseWithCertificate.certificate?.number;
    const issuedAt = courseWithCertificate.certificate?.issuedAt ?? new Date();
    if (!certificateNumber) {
      const err = new Error("Certificate record created but number is missing");
      Sentry.captureException(err);
      logger.error(err.message, { userCourseId: thisUserCourse.id });
      await CertificateService.rollbackClaim({ userCourseId: thisUserCourse.id, allocationId: allocation.id });
      return;
    }

    // Generate certificate image
    if (!courseConfig?.canvasFunction) {
      logger.error("No certificate generation function found for course", { courseId: payload.courseId });
      await CertificateService.rollbackClaim({ userCourseId: thisUserCourse.id, allocationId: allocation.id });
      return;
    }

    // TODO: update for additional courses
    // Dates come from the rows just written rather than the request that queued this job, so a
    // regeneration renders the same values off the same columns.
    const canvas = await courseConfig.canvasFunction({
      userCourseId: thisUserCourse.id,
      certificateNumber,
      completionDate: formatCertificateDate(courseWithCertificate.completedAt ?? issuedAt),
      issuedDate: formatCertificateDate(issuedAt),
    });

    if (!canvas) {
      Sentry.captureMessage("Certificate canvas generation failed after allocation was consumed", {
        extra: { userCourseId: thisUserCourse.id, allocationId: allocation.id },
      });
      logger.error("Certificate generation failed", { userCourseId: thisUserCourse.id });
      await EmailService.send({
        to: INTERNAL_EMAIL,
        from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        subject: `🚨 Certificate generation failed for ${payload.courseName}`,
        react: CertificateGenerationFailureInternalEmail({
          userId: user.id,
          userCourseId: thisUserCourse.id,
          courseName: payload.courseName,
          reason: "Canvas generation returned null after allocation was consumed",
        }),
      }).catch((err) => logger.warn("Failed to send generation failure email", { error: err }));
      await CertificateService.rollbackClaim({ userCourseId: thisUserCourse.id, allocationId: allocation.id });
      return;
    }

    // Upload certificate to S3
    try {
      const upload = await Bucket.uploadFile({ key, file: canvas.toBuffer("image/png") });
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (upload) {
        logger.info(`Certificate uploaded with status code ${upload.$metadata.httpStatusCode}`);
        logger.info(`Certificate url: ${ASSET_BASE_URL}/${key}`);
      }
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "Failed to upload certificate", {
        error,
        userCourseId: thisUserCourse.id,
      });
      await CertificateService.rollbackClaim({ userCourseId: thisUserCourse.id, allocationId: allocation.id });
      await EmailService.send({
        to: INTERNAL_EMAIL,
        from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        subject: `🚨 Certificate upload failed for ${payload.courseName}`,
        react: CertificateGenerationFailureInternalEmail({
          userId: user.id,
          userCourseId: thisUserCourse.id,
          courseName: payload.courseName,
          reason: error instanceof Error ? error.message : "Failed to upload certificate to S3",
        }),
      }).catch((err) => logger.warn("Failed to send upload failure email", { error: err }));
      return;
    }

    // Upload succeeded; the certificate is valid regardless of whether this notification email succeeds
    try {
      const { messageId } = await EmailService.send({
        from: `${payload.courseName} <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "Your certificate is ready!",
        react: CertificateReadyEmail({
          firstName: user.firstName,
          courseName: payload.courseName,
          downloadUrl: `${ASSET_BASE_URL}/${key}`,
        }),
      });
      logger.info(`Certificate success email sent with message ID ${messageId}`);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "Failed to send certificate ready email", {
        error,
        userCourseId: thisUserCourse.id,
      });
    }
  },
});
