import { logger, schedules } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { hipHopDrivingCertificationSchema } from "~/components/pre-certificate-forms/hiphopdriving";
import { SERVER_CONFIG } from "~/config.server";
import HiphopExportFailureInternalEmail from "~/emails/hiphop-export-failure-internal";
import { Bucket } from "~/integrations/bucket.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";

const CP_LICENSE_NUMBER = "CP1198";
const DELIVERY_METHOD = "A";
const VOICE_CODE = "O";
const REPORT_RECIPIENTS = ["paulh.morris@gmail.com"];

export type UnexportedCertificate = Awaited<ReturnType<typeof CertificateService.getUnexported>>[number];

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

export function buildExportRows(certificates: Array<UnexportedCertificate>): BuildExportRowsResult {
  const rows: Array<ExportRow> = [];
  const invalidRows: Array<InvalidSubmissionRow> = [];

  for (const cert of certificates) {
    const formSubmission = cert.userCourse.preCertificationFormSubmission;
    if (!formSubmission) {
      logger.warn(`Certificate ${cert.id} has no pre-certification form submission`, {
        certificateId: cert.id,
        userCourseId: cert.userCourseId,
      });
      invalidRows.push({
        certId: cert.id,
        certNumber: cert.number,
        userCourseId: cert.userCourseId,
        issueDate: formatDate(cert.issuedAt),
        reason: "Missing pre-certification form submission",
        rawFormData: "",
      });
      continue;
    }

    const parsed = hipHopDrivingCertificationSchema.safeParse(formSubmission.formData);
    if (!parsed.success) {
      logger.warn(`Certificate ${cert.id} has invalid form data`, {
        certificateId: cert.id,
        errors: parsed.error.message,
      });
      invalidRows.push({
        certId: cert.id,
        certNumber: cert.number,
        userCourseId: cert.userCourseId,
        issueDate: formatDate(cert.issuedAt),
        reason: `Validation failed: ${z.prettifyError(parsed.error)}`,
        rawFormData: JSON.stringify(formSubmission.formData),
      });
      continue;
    }

    const formData = parsed.data;

    rows.push({
      certNumber: cert.number,
      cpLicenseNumber: CP_LICENSE_NUMBER,
      deliveryMethod: DELIVERY_METHOD,
      studentLastName: formData.lastName,
      studentFirstName: formData.firstName,
      studentMiddleInitial: formData.middleInitial,
      studentAddress: formData.street,
      studentCity: formData.city,
      studentState: formData.state,
      studentZipCode: formData.zipCode,
      studentDlNumber: formData.driversLicenseNumber,
      studentDlState: formData.driversLicenseState,
      studentDateOfBirth: formData.dateOfBirth,
      studentPhoneNumber: formData.phoneNumber,
      studentGender: formData.gender,
      completionDate: formatDate(cert.userCourse.completedAt),
      issueDate: formatDate(cert.issuedAt),
      courtName: formData.courtName ?? "",
      reasonCode: formData.reasonCode,
      voiceCode: VOICE_CODE,
      replacedCertNumber: "",
      voidCodeReason: "",
      voidCode12Description: "",
    });
  }

  return { rows, invalidRows };
}

export async function buildSpreadsheet(
  rows: Array<ExportRow>,
  invalidRows: Array<InvalidSubmissionRow>,
): Promise<Buffer> {
  const { ExcelBuilder, ExcelSchemaBuilder } = await import("@chronicstone/typed-xlsx");

  const schema = ExcelSchemaBuilder.create<ExportRow>()
    .column("CERT NUMBER", { key: "certNumber" })
    .column("CP LICENSE NUMBER", { key: "cpLicenseNumber" })
    .column("DELIVERY METHOD", { key: "deliveryMethod" })
    .column("STUDENT LAST NAME", { key: "studentLastName" })
    .column("STUDENT FIRST NAME", { key: "studentFirstName" })
    .column("STUDENT MIDDLE INITIAL", { key: "studentMiddleInitial" })
    .column("STUDENT ADDRESS", { key: "studentAddress" })
    .column("STUDENT CITY", { key: "studentCity" })
    .column("STUDENT STATE", { key: "studentState" })
    .column("STUDENT ZIP CODE", { key: "studentZipCode" })
    .column("STUDENT DL NUMBER", { key: "studentDlNumber" })
    .column("STUDENT DL STATE", { key: "studentDlState" })
    .column("STUDENT DATE OF BIRTH", { key: "studentDateOfBirth" })
    .column("STUDENT PHONE NUMBER", { key: "studentPhoneNumber" })
    .column("STUDENT GENDER", { key: "studentGender" })
    .column("COMPLETION DATE", { key: "completionDate" })
    .column("ISSUE DATE", { key: "issueDate" })
    .column("COURT NAME", { key: "courtName" })
    .column("REASON CODE", { key: "reasonCode" })
    .column("VOICE CODE", { key: "voiceCode" })
    .column("REPLACED CERT NUMBER", { key: "replacedCertNumber" })
    .column("VOID CODE REASON", { key: "voidCodeReason" })
    .column("VOID CODE 12 DESCRIPTION", { key: "voidCode12Description" })
    .build();

  const invalidSubmissionSchema = ExcelSchemaBuilder.create<InvalidSubmissionRow>()
    .column("CERT ID", { key: "certId" })
    .column("CERT NUMBER", { key: "certNumber" })
    .column("USER COURSE ID", { key: "userCourseId" })
    .column("ISSUE DATE", { key: "issueDate" })
    .column("REASON", { key: "reason" })
    .column("RAW FORM DATA", { key: "rawFormData" })
    .build();

  const builder = ExcelBuilder.create().sheet("Sheet1").addTable({ data: rows, schema });

  if (invalidRows.length > 0) {
    return builder
      .sheet("Invalid Submissions")
      .addTable({ data: invalidRows, schema: invalidSubmissionSchema })
      .build({ output: "buffer", bordered: false });
  }

  return builder.build({ output: "buffer", bordered: false });
}

export const hiphopDataExport = schedules.task({
  id: "hiphop-data-export",
  // Every day at 6am
  cron: {
    pattern: "0 6 * * *",
    timezone: "America/Chicago",
    environments: ["PRODUCTION"],
  },

  run: async () => {
    let certificates: Array<UnexportedCertificate>;
    try {
      certificates = await CertificateService.getUnexported();
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to query unexported certificates", { error });
      await sendFailureEmail("Failed to query unexported certificates from the database.");
      throw error;
    }

    if (certificates.length === 0) {
      logger.info("No unexported certificates found. Skipping export.");
      return;
    }

    logger.info(`Found ${certificates.length} unexported certificate(s)`);

    let rows: Array<ExportRow>;
    let invalidRows: Array<InvalidSubmissionRow>;
    try {
      ({ rows, invalidRows } = buildExportRows(certificates));
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to build export rows", { error });
      await sendFailureEmail("Failed to build export rows from certificate data.");
      throw error;
    }

    if (rows.length === 0 && invalidRows.length === 0) {
      logger.warn("No valid or invalid rows to export. Skipping.");
      return;
    }

    logger.info(`Built ${rows.length} export row(s) and ${invalidRows.length} invalid submission(s)`);

    let file: Buffer;
    try {
      file = await buildSpreadsheet(rows, invalidRows);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to build spreadsheet", { error });
      await sendFailureEmail("Failed to generate the Excel spreadsheet.");
      throw error;
    }

    const dateStr = new Date()
      .toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        timeZone: "America/Chicago",
      })
      .replace(/\//g, "-");
    const filename = `hiphop-driving-certificates-${dateStr}.xlsx`;

    try {
      const key = `reports/hiphop/${filename}`;
      await Bucket.uploadFile({ key, file });
      logger.info(`Report uploaded to R2 at ${key}`);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to upload report to R2", { error });
      // Non-fatal: continue to send email even if R2 upload fails
    }

    const invalidWarning =
      invalidRows.length > 0
        ? `<p><strong>Warning:</strong> ${invalidRows.length} certificate(s) had invalid or missing form data. See the "Invalid Submissions" sheet.</p>`
        : "";

    try {
      await EmailService.send({
        from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
        to: REPORT_RECIPIENTS,
        subject: `Hip Hop Driving Certificate Export - ${dateStr}`,
        html: `
          <p>Attached is the daily Hip Hop Driving certificate export containing ${rows.length} valid certificate(s).</p>
          ${invalidWarning}
        `,
        attachments: [
          {
            content: file,
            filename,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      });
      logger.info("Export email sent successfully");
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to send export email", { error });
      await sendFailureEmail("Failed to send the export email with the spreadsheet attachment.");
      throw error;
    }

    try {
      const exportedCertNumbers = new Set(rows.map((r) => r.certNumber));
      const exportedIds = certificates.filter((c) => exportedCertNumbers.has(c.number)).map((c) => c.id);
      if (exportedIds.length > 0) {
        await CertificateService.markExported(exportedIds);
        logger.info(`Marked ${exportedIds.length} certificate(s) as exported`);
      }
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to mark certificates as exported", { error });
      await sendFailureEmail(
        "The export email was sent successfully, but we failed to mark the certificates as exported. This may result in duplicate exports.",
      );
      throw error;
    }
  },
});

async function sendFailureEmail(detail: string) {
  try {
    await EmailService.send({
      from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
      to: REPORT_RECIPIENTS,
      subject: "Hip Hop Driving Certificate Export Failed",
      react: <HiphopExportFailureInternalEmail detail={detail} />,
    });
  } catch (emailError) {
    Sentry.captureException(emailError);
    logger.error("Failed to send failure notification email", { emailError });
  }
}

export type ExportRow = {
  certNumber: string;
  cpLicenseNumber: string;
  deliveryMethod: string;
  studentLastName: string;
  studentFirstName: string;
  studentMiddleInitial: string;
  studentAddress: string;
  studentCity: string;
  studentState: string;
  studentZipCode: string;
  studentDlNumber: string;
  studentDlState: string;
  studentDateOfBirth: string;
  studentPhoneNumber: string;
  studentGender: string;
  completionDate: string;
  issueDate: string;
  courtName: string;
  reasonCode: string;
  voiceCode: string;
  replacedCertNumber: string;
  voidCodeReason: string;
  voidCode12Description: string;
};

export type InvalidSubmissionRow = {
  certId: number;
  certNumber: string;
  userCourseId: number;
  issueDate: string;
  reason: string;
  rawFormData: string;
};

export type BuildExportRowsResult = {
  rows: Array<ExportRow>;
  invalidRows: Array<InvalidSubmissionRow>;
};
