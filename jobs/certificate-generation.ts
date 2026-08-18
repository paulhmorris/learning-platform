import { Canvas, createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { logger } from "@trigger.dev/sdk/v3";

import { hipHopDrivingCertificationSchema } from "~/components/pre-certificate-forms/hiphopdriving";
import { db } from "~/integrations/db.server";

export const ASSET_BASE_URL = "https://assets.hiphopdriving.com";

/**
 * Certificate dates are printed in the issuing state's timezone, not the worker's. A claim just
 * before midnight UTC and a later regeneration on a differently-configured machine must render the
 * same date, since it's the date reported to the state.
 */
const CERTIFICATE_TIME_ZONE = "America/Chicago";

export function formatCertificateDate(date: Date) {
  return date.toLocaleDateString("en-US", { timeZone: CERTIFICATE_TIME_ZONE });
}

const CERT_FONT_FAMILY = "Inter";
const FONT_URL = "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2";

// The @napi-rs/canvas runtime has no system fonts available (e.g. Arial), so
// text draws as blank glyphs unless we register a font file ourselves.
let fontRegistered = false;
async function ensureFontRegistered() {
  if (fontRegistered || GlobalFonts.has(CERT_FONT_FAMILY)) {
    return;
  }
  const res = await fetch(FONT_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch font: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  GlobalFonts.register(buffer, CERT_FONT_FAMILY);
  fontRegistered = true;
  logger.info(`Registered font: ${CERT_FONT_FAMILY}`);
}

export type CertificateCanvasArgs = {
  userCourseId: number;
  certificateNumber: string;
  issuedDate: string;
  completionDate: string;
};

// BUSINESS LOGIC
export const certificateMap = [
  {
    // Dev, staging, and prod Ids
    courseIds: ["cmsxnxft50000sb95g23azfb1", "cmj3fal250001sbom8cjbvh8y", "cm3kbh75c0002qls5gvtkh6ev"],
    businessChecksFunction: runHipHopBusinessChecks,
    canvasFunction: generateHipHopCertificate,
  },
];
// END BUSINESS LOGIC

async function runHipHopBusinessChecks(userCourseId: number) {
  const formSubmissionCount = await db.preCertificationFormSubmission.count({ where: { userCourseId } });
  if (formSubmissionCount < 1) {
    logger.warn("HipHop certificate generation function is not ready: no precertification form submission found", {
      userCourseId,
    });
  }
  return formSubmissionCount > 0;
}

async function generateHipHopCertificate(args: CertificateCanvasArgs): Promise<Canvas | null> {
  const REASON_CODE_COPY_LABEL: Record<"T" | "I" | "E", string> = {
    I: "Insurance Copy",
    T: "Court Copy",
    E: "Student Copy",
  };

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

  const canvas = createCanvas(1710, 2284);
  const ctx = canvas.getContext("2d");
  const certImage = await loadImage(`${ASSET_BASE_URL}/hiphop_driving_certificate_template.png`).catch((err) => {
    logger.error("Failed to load certificate base image", { error: err });
    return null;
  });

  if (!certImage) {
    return null;
  }

  await ensureFontRegistered();

  const {
    firstName,
    lastName,
    driversLicenseNumber,
    dateOfBirth,
    reasonCode,
    courtName,
    street,
    city,
    state,
    zipCode,
  } = parsedAnswers.data;
  const fullName = `${firstName} ${lastName}`;
  const cityStateZip = `${city}, ${state} ${zipCode}`;
  const copyLabel = REASON_CODE_COPY_LABEL[reasonCode];

  ctx.drawImage(certImage, 0, 0, 1710, 2284);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "left";
  ctx.font = `28px ${CERT_FONT_FAMILY}`;

  // Right-column field values, shared between the office copy (offsetY 0) and student copy (offsetY 1206)
  const drawFieldColumn = (offsetY: number, includeCourtInfo: boolean) => {
    ctx.fillText(args.certificateNumber, 1465, 60 + offsetY);
    ctx.fillText(fullName, 1265, 228 + offsetY);
    ctx.fillText(driversLicenseNumber, 1265, 358 + offsetY);
    ctx.fillText(dateOfBirth, 1265, 489 + offsetY);
    ctx.fillText(args.completionDate, 1265, 762 + offsetY);
    ctx.fillText(args.issuedDate, 1265, 853 + offsetY);
    ctx.fillText(reasonCode, 1265, 943 + offsetY);
    if (includeCourtInfo) {
      ctx.fillText(courtName ?? "N/A", 1265, 1031 + offsetY);
    }
  };

  // Left-column "Student Name and Mailing Address" block, shared between both copies
  const drawAddressBlock = (offsetY: number) => {
    ctx.fillText(fullName, 140, 842 + offsetY);
    ctx.fillText(street, 140, 882 + offsetY);
    ctx.fillText(cityStateZip, 140, 921 + offsetY);
  };

  // Office copy (top half); only this copy has a "Court Information" field
  drawFieldColumn(0, true);
  drawAddressBlock(0);

  ctx.save();
  ctx.font = `bold 40px ${CERT_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.letterSpacing = "2px";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";
  const watermarkX = 670;
  const watermarkY = 165;
  ctx.strokeText(copyLabel.toUpperCase(), watermarkX, watermarkY);
  ctx.fillText(copyLabel.toUpperCase(), watermarkX, watermarkY);
  ctx.restore();

  // Student copy (bottom half)
  drawFieldColumn(1206, false);
  drawAddressBlock(1206);

  logger.info("Certificate generated");
  return canvas;
}
