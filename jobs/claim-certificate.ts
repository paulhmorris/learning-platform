import { createCanvas, loadImage } from "@napi-rs/canvas";
import { logger, task } from "@trigger.dev/sdk/v3";
import { nanoid } from "nanoid";

import { Bucket } from "~/integrations/bucket.server";
import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";

// TODO: Add certificate number to pdf

export const claimCertificateJob = task({
  id: "claim-certificate",
  run: async (payload: { userId: string; courseId: string; courseName: string }) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: payload.userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        courses: {
          where: { courseId: payload.courseId },
          select: {
            id: true,
            courseId: true,
            certificateClaimed: true,
            certificateS3Key: true,
          },
        },
      },
    });

    logger.info("User found", user);

    const thisCourse = user.courses.find((c) => c.courseId === payload.courseId);
    if (!thisCourse) {
      logger.error("User has not completed this course", user);
      throw new Error("User has not completed this course");
    }

    // Check if certificate has already been claimed
    if (thisCourse.certificateClaimed) {
      logger.info("Certificate already claimed. Sending another email.", user);
      const email = await EmailService.send({
        from: `Plumb Learning <no-reply@plumblearning.com>`,
        to: user.email,
        subject: "View Your Certificate!",
        html: `
          <p>Hi ${user.firstName},</p>
          <p>Congratulations on completing the ${payload.courseName} course! Your certificate is ready to download.</p>
          <p><a href="https://assets.hiphopdriving.com/${thisCourse.certificateS3Key}" target="_blank">Download Certificate</a></p>
        `,
      });
      logger.info("Email sent", email);
    }

    // Generate certificate
    const canvas = createCanvas(1920, 1357);
    const ctx = canvas.getContext("2d");
    const certImage = await loadImage("https://assets.hiphopdriving.com/certificate_f2ffea5abd.png");

    const date = new Date().toLocaleDateString("en-US");

    ctx.drawImage(certImage, 0, 0, 1920, 1357);
    ctx.textAlign = "center";

    ctx.font = "48px Helvetica";
    ctx.fillText(`${user.firstName} ${user.lastName}`, 972, 624);

    ctx.font = "32px Helvetica";
    ctx.fillText(payload.courseName, 972, 728);

    ctx.font = "24px Helvetica";
    ctx.fillText(date, 812, 1080);

    logger.info("Certificate generated");

    // Upload certificate to S3
    const key = `certificates/${user.email}-${nanoid(8)}.png`;
    const upload = await Bucket.uploadFile({ key, file: canvas.toBuffer("image/png") });

    logger.info("Certificate uploaded", upload as unknown as Record<string, unknown>);

    // send email with link to image
    const email = await EmailService.send({
      from: `${payload.courseName} <no-reply@plumblearning.com>`,
      // to: user.email,
      to: "paulh.morris@gmail.com",
      subject: "Your certificate is ready!",
      html: `
        <p>Hi ${user.firstName},</p>
        <p>Congratulations on completing the ${payload.courseName} course! Your certificate is ready to download.</p>
        <p><a href="https://assets.hiphopdriving.com/${key}" target="_blank">Download Certificate</a></p>
      `,
    });
    logger.info("Email sent", email);

    // Update user course
    const updatedCourse = await db.userCourses.update({
      where: {
        userId_courseId: {
          userId: payload.userId,
          courseId: payload.courseId,
        },
      },
      data: {
        isCompleted: true,
        completedAt: new Date(),
        certificateS3Key: key,
        certificateClaimed: true,
      },
    });

    logger.info("User course updated", updatedCourse);
  },
});
