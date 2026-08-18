import { logger, task } from "@trigger.dev/sdk/v3";

import { SERVER_CONFIG } from "~/config.server";
import CertificateReadyEmail from "~/emails/certificate-ready";
import { Bucket } from "~/integrations/bucket.server";
import { Sentry } from "~/integrations/sentry";
import { EmailService } from "~/integrations/email.server";
import { CertificateService } from "~/services/certificate.server";
import { UserService } from "~/services/user.server";

import { ASSET_BASE_URL, certificateMap, formatCertificateDate } from "./certificate-generation";

type JobPayload = {
  userCourseId: number;
  courseName: string;
  sendEmail: boolean;
};

/**
 * Re-renders an already-issued certificate from the current pre-certification answers, keeping the
 * original certificate number and issue date. Support uses this after correcting a student's
 * answers; the corrected file overwrites the original so links already sent out resolve to it.
 */
export const regenerateCertificateJob = task({
  id: "regenerate-certificate",
  run: async (payload: JobPayload) => {
    const userCourse = await CertificateService.getForRegeneration(payload.userCourseId);

    if (!userCourse) {
      logger.error("User course not found", { userCourseId: payload.userCourseId });
      throw new Error("User course not found");
    }

    const { certificate } = userCourse;
    if (!certificate) {
      logger.error("User course has no certificate to regenerate", { userCourseId: payload.userCourseId });
      throw new Error("User course has no certificate to regenerate");
    }

    const courseConfig = certificateMap.find((c) => c.courseIds.includes(userCourse.courseId));
    if (!courseConfig?.canvasFunction) {
      logger.error("No certificate generation function found for course", { courseId: userCourse.courseId });
      throw new Error("No certificate generation function found for course");
    }

    // Reuse the original number and dates: this is an amendment of an existing certificate, not a
    // new one, and the state's record is keyed on them. Never today's date — that would silently
    // move the completion date on a document already reported.
    const canvas = await courseConfig.canvasFunction({
      userCourseId: userCourse.id,
      certificateNumber: certificate.number,
      completionDate: formatCertificateDate(userCourse.completedAt ?? certificate.issuedAt),
      issuedDate: formatCertificateDate(certificate.issuedAt),
    });

    if (!canvas) {
      Sentry.captureMessage("Certificate regeneration failed", {
        extra: { userCourseId: userCourse.id, certificateId: certificate.id },
      });
      logger.error("Certificate regeneration failed", { userCourseId: userCourse.id });
      throw new Error("Certificate regeneration failed");
    }

    // Overwriting the existing key means certificate links already emailed to the student resolve
    // to the corrected file rather than leaving the incorrect one published.
    const key = certificate.s3Key ?? buildCertificateKey(payload.courseName, userCourse.userId);

    try {
      await Bucket.uploadFile({ key, file: canvas.toBuffer("image/png") });
      logger.info(`Regenerated certificate uploaded to ${key}`);
    } catch (error) {
      Sentry.captureException(error, { extra: { userCourseId: userCourse.id } });
      logger.error(error instanceof Error ? error.message : "Failed to upload regenerated certificate", {
        userCourseId: userCourse.id,
      });
      throw error;
    }

    if (!certificate.s3Key) {
      await CertificateService.updateS3Key(certificate.id, key);
    }

    if (!payload.sendEmail) {
      logger.info("Skipping student notification for regenerated certificate", { userCourseId: userCourse.id });
      return;
    }

    const user = await UserService.getById(userCourse.userId);
    if (!user?.email) {
      Sentry.captureMessage("Regenerated certificate could not be emailed: user has no email", {
        extra: { userCourseId: userCourse.id, userId: userCourse.userId },
      });
      logger.error("Cannot email regenerated certificate, user has no email", { userId: userCourse.userId });
      return;
    }

    // The regenerated file is already live; a failed notification does not invalidate it.
    try {
      const { messageId } = await EmailService.send({
        from: `${payload.courseName} <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: user.email,
        subject: "Your updated certificate is ready!",
        react: CertificateReadyEmail({
          firstName: user.firstName,
          courseName: payload.courseName,
          downloadUrl: `${ASSET_BASE_URL}/${key}`,
        }),
      });
      logger.info(`Regenerated certificate email sent with message ID ${messageId}`);
    } catch (error) {
      Sentry.captureException(error, { extra: { userCourseId: userCourse.id } });
      logger.error(error instanceof Error ? error.message : "Failed to send regenerated certificate email", {
        userCourseId: userCourse.id,
      });
    }
  },
});

function buildCertificateKey(courseName: string, userId: string) {
  const now = new Date();
  const safeCourseName = courseName
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
  return `certificates/${safeCourseName}/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}/${userId}-${Date.now()}.png`;
}
