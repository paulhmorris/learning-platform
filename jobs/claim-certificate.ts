import { Canvas, createCanvas, loadImage } from "@napi-rs/canvas";
import { logger, task } from "@trigger.dev/sdk/v3";

import { hipHopDrivingCertificationSchema } from "~/components/pre-certificate-forms/hiphopdriving";
import { CONFIG } from "~/config";
import { SERVER_CONFIG } from "~/config.server";
import { Bucket } from "~/integrations/bucket.server";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";

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
    const _user = await db.user.findUniqueOrThrow({
      where: { id: payload.userId },
      select: {
        id: true,
        clerkId: true,
        courses: {
          where: { courseId: payload.courseId },
          select: {
            id: true,
            courseId: true,
            certificateClaimed: true,
            completedAt: true,
            certificate: {
              select: {
                id: true,
                number: true,
                s3Key: true,
              },
            },
          },
        },
      },
    });

    if (!_user.clerkId) {
      logger.error(`User ${payload.userId} missing clerkId`);
      throw new Error("User identity not available");
    }

    // TODO: Update when clerkId is required
    const clerkUser = await clerkClient.users.getUser(_user.clerkId);

    const email = clerkUser.emailAddresses.at(0)?.emailAddress;
    if (!email) {
      logger.error(`User ${payload.userId} does not have an email address`);
      throw new Error("User does not have an email address");
    }

    const user = {
      ..._user,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      phoneNumber: clerkUser.phoneNumbers.at(0)?.phoneNumber,
    };

    logger.info(`User ${user.id} found for certificate claim (course ${payload.courseId})`);

    const thisUserCourse = user.courses.find((c) => c.courseId === payload.courseId);
    if (!thisUserCourse) {
      logger.error(`User ${user.id} has not completed course ${payload.courseId}`);
      throw new Error("User has not completed this course");
    }

    // Check if certificate has already been claimed
    if (thisUserCourse.certificate) {
      logger.info(`Certificate already claimed for user ${user.id}. Sending another email.`);
      const email = await EmailService.send({
        from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "View Your Certificate!",
        html: `
          <p>Hi ${user.firstName},</p>
          <p>Congratulations on completing the ${payload.courseName} course! Your certificate is ready to download.</p>
          <p><a href="https://assets.hiphopdriving.com/${thisUserCourse.certificate.s3Key}" target="_blank">Download Certificate</a></p>
        `,
      });
      logger.info(`Certificate email sent to ${user.email}`);
      return;
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

    // Verify that the certificate generation function is ready
    const canvasReadyFunction = certificateMap.find((c) =>
      c.courseIds.includes(payload.courseId),
    )?.businessChecksFunction;
    if (canvasReadyFunction) {
      const isReady = await canvasReadyFunction(thisUserCourse.id);
      if (!isReady) {
        logger.error(`Certificate generation function lacking requirements for user course ${thisUserCourse.id}`);
        throw new Error("Certificate generation function is lacking requirements");
      }
    }

    // Pull certificate allocation and create certificate entry
    const allocation = await CertificateService.getNextAllocationForCourse(payload.courseId);
    if (!allocation) {
      logger.error(`No certificate allocations available for course ${payload.courseId}`);
      const sentEmail = await EmailService.send({
        from: `${payload.courseName} <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "There was an issue creating your certificate!",
        html: `
        <p>Hi ${user.firstName},</p>
        <p>Congratulations on completing the ${payload.courseName} course! However, there was an issue on our end creating your certificate.</p>
        <p>Our team has been notified, but feel free to reach out to support at ${CONFIG.supportEmail} for more help. Rest assured, <b>your course is completed and your progress has been saved</b>.</p>
      `,
      });
      logger.info(`Certificate allocation unavailable email sent to ${user.email}`);
      return;
    }

    logger.info(`Found certificate allocation ${allocation.id} with number ${allocation.number} for course ${payload.courseId}`);

    let courseWithCertificate = null;
    try {
      courseWithCertificate = await CertificateService.createAndUpdateCourse({
        s3Key: key,
        number: allocation.number,
        userCourseId: thisUserCourse.id,
      });
      logger.info(`User course ${thisUserCourse.id} marked complete and certificate linked. Beginning certificate creation...`);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to create certificate for user course ${thisUserCourse.id}`, { error });
      return;
    }

    // Generate certificate
    const canvasFunction = certificateMap.find((c) => c.courseIds.includes(payload.courseId))?.canvasFunction;
    if (!canvasFunction) {
      logger.error(`No certificate generation function found for course ${payload.courseId}`);
      return;
    }

    // TODO: update for additional courses
    const canvas = await canvasFunction({
      userCourseId: thisUserCourse.id,
      certificateNumber: courseWithCertificate.certificate!.number,
      completionDate: thisUserCourse.completedAt?.toLocaleDateString("en-US") ?? new Date().toLocaleDateString("en-US"),
    });

    if (!canvas) {
      logger.error(`Certificate generation failed for user course ${thisUserCourse.id}`);
      return;
    }
    // Upload certificate to S3
    try {
      const upload = await Bucket.uploadFile({ key, file: canvas.toBuffer("image/png") });

      logger.info(`Certificate uploaded to S3 with status ${upload.$metadata.httpStatusCode} (key: ${key})`);

      // send email with link to image
      const sentEmail = await EmailService.send({
        from: `${payload.courseName} <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "Your certificate is ready!",
        html: `
          <p>Hi ${user.firstName},</p>
          <p>Congratulations on completing the ${payload.courseName} course! Your certificate is ready to download.</p>
          <p><a href="https://assets.hiphopdriving.com/${key}" target="_blank">Download Certificate</a></p>
        `,
      });
      logger.info(`Certificate email sent to ${user.email}`);
      return;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to upload certificate or send email for user ${user.id}`, { error });
      return;
    }
  },
});

async function runHipHopBusinessChecks(userCourseId: number) {
  const formSubmissionCount = await db.preCertificationFormSubmission.count({ where: { userCourseId } });
  if (formSubmissionCount < 1) {
    logger.warn(`HipHop certificate generation not ready for user course ${userCourseId}: no precertification form submission found`);
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
    logger.error(`No precertification form submission found for user course ${args.userCourseId}`);
    return null;
  }
  const parsedAnswers = hipHopDrivingCertificationSchema.safeParse(answers.formData);
  if (!parsedAnswers.success) {
    logger.error(`Precertification form submission data invalid for user course ${args.userCourseId}: ${parsedAnswers.error.message}`);
    return null;
  }
  const canvas = createCanvas(1650, 1275);
  const ctx = canvas.getContext("2d");
  const certImage = await loadImage("https://assets.hiphopdriving.com/certificate_f2ffea5abd.png").catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to load certificate base image: ${errorMessage}`, { error: err });
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

  logger.info(`HipHop certificate generated for user course ${args.userCourseId}`);
  return canvas;
}
