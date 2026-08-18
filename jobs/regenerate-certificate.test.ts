/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@napi-rs/canvas", () => {
  const mockCtx = {
    drawImage: vi.fn(),
    fillText: vi.fn(),
    textAlign: "",
    font: "",
    save: vi.fn(),
    strokeText: vi.fn(),
    restore: vi.fn(),
  };
  const mockCanvas = {
    getContext: vi.fn(() => mockCtx),
    toBuffer: vi.fn(() => Buffer.from("fake-png")),
  };
  return {
    createCanvas: vi.fn(() => mockCanvas),
    loadImage: vi.fn(() => Promise.resolve({ width: 1650, height: 1275 })),
    Canvas: vi.fn(),
    GlobalFonts: { has: vi.fn(() => true), register: vi.fn() },
  };
});

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  task: vi.fn((opts: { id: string; run: (...args: Array<unknown>) => unknown }) => opts),
}));

vi.mock("~/integrations/db.server", () => ({
  db: {
    preCertificationFormSubmission: { count: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock("~/integrations/bucket.server", () => ({ Bucket: { uploadFile: vi.fn() } }));
vi.mock("~/integrations/email.server", () => ({ EmailService: { send: vi.fn() } }));
vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn(), captureMessage: vi.fn() },
}));

vi.mock("~/services/certificate.server", () => ({
  CertificateService: { getForRegeneration: vi.fn(), updateS3Key: vi.fn() },
}));

vi.mock("~/services/user.server", () => ({ UserService: { getById: vi.fn() } }));

vi.mock("~/config.server", () => ({ SERVER_CONFIG: { emailFromDomain: "test.com" } }));

vi.mock("~/components/pre-certificate-forms/hiphopdriving", () => ({
  hipHopDrivingCertificationSchema: z.object({
    firstName: z.string(),
    lastName: z.string(),
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    driversLicenseNumber: z.string(),
    dateOfBirth: z.string(),
    reasonCode: z.enum(["T", "I", "E"]),
    courtName: z.string().optional(),
  }),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { createCanvas } from "@napi-rs/canvas";

import { Bucket } from "~/integrations/bucket.server";
import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { CertificateService } from "~/services/certificate.server";
import { UserService } from "~/services/user.server";

import { regenerateCertificateJob } from "./regenerate-certificate";

const mockCertificateService = vi.mocked(CertificateService);
const mockUserService = vi.mocked(UserService);
const mockEmailService = vi.mocked(EmailService);
const mockBucket = vi.mocked(Bucket);
const mockDb = vi.mocked(db, true);

const run = (regenerateCertificateJob as unknown as { run: (payload: unknown) => Promise<void> }).run;

const HIPHOP_COURSE_ID = "cm3kbh75c0002qls5gvtkh6ev";

const formData = {
  firstName: "Jane",
  lastName: "Doe",
  street: "123 Main St",
  city: "City of Lubbock",
  state: "TX",
  zipCode: "79401",
  driversLicenseNumber: "1234567890",
  dateOfBirth: "01/01/2000",
  reasonCode: "T" as const,
  courtName: "City of Lubbock",
};

function buildUserCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    userId: "user_1",
    courseId: HIPHOP_COURSE_ID,
    completedAt: new Date("2026-01-05T00:00:00Z"),
    certificate: {
      id: 7,
      number: "CERT-001",
      s3Key: "certificates/hip-hop/2026/1/5/user_1-123.png",
      issuedAt: new Date("2026-01-06T00:00:00Z"),
      isExported: new Date("2026-01-07T00:00:00Z"),
    },
    preCertificationFormSubmission: { formData, updatedAt: new Date() },
    ...overrides,
  };
}

const payload = { userCourseId: 42, courseName: "Hip Hop Driving", sendEmail: false };

describe("regenerateCertificateJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.preCertificationFormSubmission.findFirst.mockResolvedValue({ formData } as never);
    mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);
    mockUserService.getById.mockResolvedValue({
      id: "user_1",
      email: "jane@test.com",
      firstName: "Jane",
    } as never);
  });

  it("overwrites the existing s3 key so links already sent resolve to the corrected file", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(buildUserCourse() as never);

    await run(payload);

    expect(mockBucket.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ key: "certificates/hip-hop/2026/1/5/user_1-123.png" }),
    );
    expect(mockCertificateService.updateS3Key).not.toHaveBeenCalled();
  });

  it("prints the original dates in the certificate timezone, never today's date", async () => {
    // issuedAt is 2026-01-06T00:00:00Z, which is still 1/5/2026 in America/Chicago.
    mockCertificateService.getForRegeneration.mockResolvedValue(
      buildUserCourse({ completedAt: null }) as never,
    );

    await run(payload);

    const ctx = vi.mocked(createCanvas).mock.results[0]!.value.getContext("2d");
    const printed = vi.mocked(ctx.fillText).mock.calls.map((call: Array<unknown>) => call[0]);
    expect(printed).toContain("1/5/2026");
    expect(printed).not.toContain(new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" }));
  });

  it("does not email the student when sendEmail is false", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(buildUserCourse() as never);

    await run(payload);

    expect(mockEmailService.send).not.toHaveBeenCalled();
  });

  it("emails the student when sendEmail is true", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(buildUserCourse() as never);

    await run({ ...payload, sendEmail: true });

    expect(mockEmailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@test.com", subject: "Your updated certificate is ready!" }),
    );
  });

  it("stores a generated key when the certificate has none", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(
      buildUserCourse({
        certificate: {
          id: 7,
          number: "CERT-001",
          s3Key: null,
          issuedAt: new Date("2026-01-06T00:00:00Z"),
          isExported: null,
        },
      }) as never,
    );

    await run(payload);

    const key = mockBucket.uploadFile.mock.calls[0]![0].key;
    expect(key).toMatch(/^certificates\/hip-hop-driving\//);
    expect(mockCertificateService.updateS3Key).toHaveBeenCalledWith(7, key);
  });

  it("throws when the user course has no certificate", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(
      buildUserCourse({ certificate: null }) as never,
    );

    await expect(run(payload)).rejects.toThrow("User course has no certificate to regenerate");
    expect(mockBucket.uploadFile).not.toHaveBeenCalled();
  });

  it("throws when the course has no certificate generator configured", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(
      buildUserCourse({ courseId: "some_other_course" }) as never,
    );

    await expect(run(payload)).rejects.toThrow("No certificate generation function found for course");
  });

  it("throws without emailing when the canvas cannot be built", async () => {
    mockCertificateService.getForRegeneration.mockResolvedValue(buildUserCourse() as never);
    mockDb.preCertificationFormSubmission.findFirst.mockResolvedValue(null as never);

    await expect(run({ ...payload, sendEmail: true })).rejects.toThrow("Certificate regeneration failed");
    expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    expect(mockEmailService.send).not.toHaveBeenCalled();
  });
});
