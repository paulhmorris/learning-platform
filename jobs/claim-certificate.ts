import { Canvas, createCanvas, loadImage } from "@napi-rs/canvas";
import { logger, task } from "@trigger.dev/sdk/v3";

import { hipHopDrivingCertificationSchema } from "~/components/pre-certificate-forms/hiphopdriving";
import { SERVER_CONFIG } from "~/config.server";
import AllocationsLowInternalEmail from "~/emails/allocations-low-internal";
import CertificateGenerationFailureInternalEmail from "~/emails/certificate-generation-failure-internal";
import CertificateIssueEmail from "~/emails/certificate-issue";
import CertificateReadyEmail from "~/emails/certificate-ready";
import { Bucket } from "~/integrations/bucket.server";
import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";
import { UserCourseService } from "~/services/user-course.server";
import { UserService } from "~/services/user.server";

const ASSET_BASE_URL = "https://assets.hiphopdriving.com";
const CERT_IMAGE_URL = `${ASSET_BASE_URL}/certificate_f2ffea5abd.png`;
const INTERNAL_EMAIL = `events@${SERVER_CONFIG.emailFromDomain}`;
const ALLOCATION_LOW_THRESHOLD = 10;

// BUSINESS LOGIC
const certificateMap = [
  {
    // Dev, staging, and prod Ids
    courseIds: ["cmj3fal250001sbom8cjbvh8y", "cm3kbh75c0002qls5gvtkh6ev"],
    businessChecksFunction: runHipHopBusinessChecks,
    canvasFunction: generateHipHopCertificate,
  },
];
// END BUSINESS LOGIC

export const claimCertificateJob = task({
  id: "claim-certificate",
  run: async (payload: { userId: string; courseId: string; courseName: string }) => {
    // TODO: Update when clerkId is required
    let user;
    try {
      user = await UserService.getById(payload.userId);
    } catch (error) {
      Sentry.captureException(error, { extra: { userId: payload.userId } });
      logger.error("Error fetching user for certificate claim", { error, userId: payload.userId });
      throw new Error("Error fetching user for certificate claim");
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
      return;
    }

    const certificateNumber = courseWithCertificate.certificate?.number;
    if (!certificateNumber) {
      const err = new Error("Certificate record created but number is missing");
      Sentry.captureException(err);
      logger.error(err.message, { userCourseId: thisUserCourse.id });
      return;
    }

    // Generate certificate image
    if (!courseConfig?.canvasFunction) {
      logger.error("No certificate generation function found for course", { courseId: payload.courseId });
      return;
    }

    // TODO: update for additional courses
    const canvas = await courseConfig.canvasFunction({
      userCourseId: thisUserCourse.id,
      certificateNumber,
      completionDate: thisUserCourse.completedAt?.toLocaleDateString("en-US") ?? new Date().toLocaleDateString("en-US"),
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
      return;
    }

    // Upload certificate to S3
    try {
      const upload = await Bucket.uploadFile({ key, file: canvas.toBuffer("image/png") });
      logger.info(`Certificate uploaded with status code ${upload.$metadata.httpStatusCode}`);

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
      logger.error(error instanceof Error ? error.message : "Failed to upload certificate", {
        error,
        userCourseId: thisUserCourse.id,
      });
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
    }
  },
});

async function runHipHopBusinessChecks(userCourseId: number) {
  const formSubmissionCount = await db.preCertificationFormSubmission.count({ where: { userCourseId } });
  if (formSubmissionCount < 1) {
    logger.warn("HipHop certificate generation function is not ready: no precertification form submission found", {
      userCourseId,
    });
  }
  return formSubmissionCount > 0;
}

type HipHopCertificateArgs = {
  userCourseId: number;
  certificateNumber: string;
  completionDate: string;
};
async function generateHipHopCertificate(args: HipHopCertificateArgs): Promise<Canvas | null> {
  const answers = await db.preCertificationFormSubmission.findFirst({ where: { userCourseId: args.userCourseId } });
  if (!answers) {
    logger.error("No precertification form submission found for user course", { userCourseId: args.userCourseId });
    return null;
  }
  const parsedAnswers = hipHopDrivingCertificationSchema.safeParse(answers.formData);
  if (!parsedAnswers.success) {
    logger.error("Precertification form submission data is invalid", {
      userCourseId: args.userCourseId,
      errors: parsedAnswers.error.message,
    });
    return null;
  }

  logger.info("Generating certificate with the following data", {
    certificateNumber: args.certificateNumber,
    completionDate: args.completionDate,
    formData: parsedAnswers.data,
  });

  const canvas = createCanvas(1650, 1275);
  const ctx = canvas.getContext("2d");
  const certImage = await loadImage(CERT_IMAGE_URL).catch((err) => {
    logger.error("Failed to load certificate base image", { error: err });
    return null;
  });

  if (!certImage) {
    return null;
  }
  const date = new Date().toLocaleDateString("en-US");

  const firstRowY = 790;
  const secondRowY = 865;
  const thirdRowY = 935;

  const firstColX = 316;
  const secondColX = 736;
  const thirdColX = 1_130;
  const fourthColX = 1_455;

  ctx.drawImage(certImage, 0, 0, 1650, 1275);
  ctx.textAlign = "left";
  ctx.font = "24px Arial";

  // Row 1
  ctx.fillText(args.certificateNumber, firstColX, firstRowY);
  ctx.fillText(`${parsedAnswers.data.firstName} ${parsedAnswers.data.lastName}`, secondColX, firstRowY);
  ctx.fillText(parsedAnswers.data.driversLicenseNumber, thirdColX, firstRowY);
  ctx.fillText(parsedAnswers.data.dateOfBirth, fourthColX, firstRowY);

  // Row 2
  ctx.fillText(args.completionDate, firstColX, secondRowY);
  ctx.fillText(date, secondColX, secondRowY);
  ctx.fillText(parsedAnswers.data.reasonCode, thirdColX, secondRowY);
  ctx.fillText(parsedAnswers.data.courtName ?? "N/A", fourthColX, secondRowY);

  // Row 3
  const { street, city, state, zipCode } = parsedAnswers.data;
  ctx.fillText(`${street}, ${city}, ${state} ${zipCode}`, firstColX, thirdRowY);

  logger.info("Certificate generated");
  return canvas;
}
