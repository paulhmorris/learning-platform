import { createCanvas, loadImage } from "@napi-rs/canvas";
import { logger, task } from "@trigger.dev/sdk/v3";
import { nanoid } from "nanoid";

import { CONFIG } from "~/config";
import { SERVER_CONFIG } from "~/config.server";
import { Bucket } from "~/integrations/bucket.server";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";

export const claimCertificateJob = task({
  id: "claim-certificate",
  run: async (payload: { userId: string; courseId: string; courseName: string }) => {
    const _user = await db.user.findUniqueOrThrow({
      where: { id: payload.userId },
      select: {
        clerkId: true,
        courses: {
          where: { courseId: payload.courseId },
          select: {
            id: true,
            courseId: true,
            certificateClaimed: true,
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

    // TODO: Update when clerkId is required
    const clerkUser = await clerkClient.users.getUser(_user.clerkId!);

    const email = clerkUser.emailAddresses.at(0)?.emailAddress;
    if (!email) {
      logger.error("User does not have an email address", _user);
      throw new Error("User does not have an email address");
    }

    const user = {
      ..._user,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      phoneNumber: clerkUser.phoneNumbers.at(0)?.phoneNumber,
    };

    logger.info("User found", user);

    const thisUserCourse = user.courses.find((c) => c.courseId === payload.courseId);
    if (!thisUserCourse) {
      logger.error("User has not completed this course", user);
      throw new Error("User has not completed this course");
    }

    // Check if certificate has already been claimed
    if (thisUserCourse.certificate) {
      logger.info("Certificate already claimed. Sending another email.", user);
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
      logger.info("Email sent", email);
      return;
    }

    const key = `certificates/${user.email}-${nanoid(24)}.png`;

    // Pull certificate allocation and create certificate entry
    const allocation = await CertificateService.getNextAllocationForCourse(payload.courseId);
    if (!allocation) {
      logger.error("No allocations available");
      const sentEmail = await EmailService.send({
        from: `${payload.courseName} <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "There was an issue creating your certificate!",
        html: `
        <p>Hi ${user.firstName},</p>
        <p>Congratulations on completing the ${payload.courseName} course! However, there was an issue on our end creating your certificate.</p>
        <p>Our team has been notified, but feel free to reach out to support at ${CONFIG.supportEmail} for more help. Rest assured, <b>Your course is completed and your progress has been saved</b>.</p>
      `,
      });
      logger.info("Email sent", sentEmail);
      return;
    }

    logger.info(`Found available allocation with id ${allocation.id} and number ${allocation.number}`);

    try {
      const updatedCourseAndCertifiate = await CertificateService.createAndUpdateCourse({
        s3Key: key,
        number: allocation.number,
        userCourseId: thisUserCourse.id,
      });
      logger.info(
        "User course marked complete and certificate linked. Beginning certificate creation...",
        updatedCourseAndCertifiate,
      );
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "", error as Record<string, unknown>);
      return;
    }

    // Generate certificate
    const canvas = createCanvas(1650, 1275);
    const ctx = canvas.getContext("2d");
    const certImage = await loadImage("https://assets.hiphopdriving.com/certificate_f2ffea5abd.png");

    const date = new Date().toLocaleDateString("en-US");

    ctx.drawImage(certImage, 0, 0, 1650, 1275);
    ctx.textAlign = "center";

    ctx.font = "48px Helvetica";
    ctx.fillText(`${user.firstName} ${user.lastName}`, 972, 624);

    ctx.font = "32px Helvetica";
    ctx.fillText(payload.courseName, 972, 728);

    ctx.font = "24px Helvetica";
    ctx.fillText(date, 812, 1080);

    logger.info("Certificate generated");

    // Upload certificate to S3
    try {
      const upload = await Bucket.uploadFile({ key, file: canvas.toBuffer("image/png") });

      logger.info(
        `Certificate uploaded with status code ${upload.$metadata.httpStatusCode} and requestId ${upload.$metadata.requestId}`,
      );

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
      logger.info("Email sent", sentEmail);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error instanceof Error ? error.message : "", error as Record<string, unknown>);
      return;
    }
  },
});
