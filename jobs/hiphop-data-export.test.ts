import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  schedules: {
    task: vi.fn((opts: { id: string; run: (...args: Array<unknown>) => unknown }) => opts),
  },
}));

vi.mock("@chronicstone/typed-xlsx", () => ({
  ExcelSchemaBuilder: {
    create: vi.fn(() => {
      const builder = {
        column: vi.fn(() => builder),
        build: vi.fn(() => "mock-schema"),
      };
      return builder;
    }),
  },
  ExcelBuilder: {
    create: vi.fn(() => {
      const sheetBuilder = {
        addTable: vi.fn(() => sheetBuilder),
        sheet: vi.fn(() => sheetBuilder),
        build: vi.fn(() => Buffer.from("mock-xlsx-content")),
      };
      return { sheet: vi.fn(() => sheetBuilder) };
    }),
  },
}));

vi.mock("~/integrations/bucket.server", () => ({
  Bucket: { uploadFile: vi.fn() },
}));

vi.mock("~/integrations/email.server", () => ({
  EmailService: { send: vi.fn() },
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

vi.mock("~/config.server", () => ({
  SERVER_CONFIG: { emailFromDomain: "test.com" },
}));

vi.mock("~/services/certificate.server", () => ({
  CertificateService: {
    getUnexported: vi.fn(),
    markExported: vi.fn(),
  },
}));

vi.mock("~/components/pre-certificate-forms/hiphopdriving", () => ({
  hipHopDrivingCertificationSchema: z.object({
    firstName: z.string(),
    lastName: z.string(),
    middleInitial: z.string(),
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    driversLicenseNumber: z.string(),
    driversLicenseState: z.string(),
    dateOfBirth: z.string(),
    phoneNumber: z.string(),
    gender: z.enum(["M", "F"]),
    reasonCode: z.enum(["T", "I", "E"]),
    courtName: z.string().optional(),
  }),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { Bucket } from "~/integrations/bucket.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";

import type { UnexportedCertificate } from "./hiphop-data-export";
import { buildExportRows, buildSpreadsheet, hiphopDataExport } from "./hiphop-data-export";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockCertificateService = vi.mocked(CertificateService);
const mockEmailService = vi.mocked(EmailService);
const mockSentry = vi.mocked(Sentry);
const mockBucket = vi.mocked(Bucket);

// schedules.task mock returns the raw options object
const runJob = (
  hiphopDataExport as unknown as {
    run: () => Promise<void>;
  }
).run;

const validFormData = {
  firstName: "John",
  lastName: "Doe",
  middleInitial: "A",
  street: "123 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  driversLicenseNumber: "DL123456",
  driversLicenseState: "TX",
  dateOfBirth: "01/15/1990",
  phoneNumber: "555-1234",
  gender: "M" as const,
  reasonCode: "T" as const,
  courtName: "Tarrant County",
};

function makeCertificate(overrides?: Partial<UnexportedCertificate>): UnexportedCertificate {
  return {
    id: 1,
    number: "CERT-001",
    issuedAt: new Date("2026-03-03T12:00:00Z"),
    userCourseId: 1,
    userCourse: {
      id: 1,
      completedAt: new Date("2026-03-02T12:00:00Z"),
      preCertificationFormSubmission: {
        formData: validFormData,
      },
    },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("hiphopDataExport", () => {
  it("has the correct task id", () => {
    expect(hiphopDataExport.id).toBe("hiphop-data-export");
  });

  // ── No certificates ────────────────────────────────────────────────────

  describe("when no unexported certificates exist", () => {
    it("returns early without sending any email", async () => {
      mockCertificateService.getUnexported.mockResolvedValue([]);

      await runJob();

      expect(mockEmailService.send).not.toHaveBeenCalled();
      expect(mockCertificateService.markExported).not.toHaveBeenCalled();
    });
  });

  // ── Query failure ──────────────────────────────────────────────────────

  describe("when certificate query fails", () => {
    it("sends failure email and re-throws", async () => {
      const error = new Error("DB connection failed");
      mockCertificateService.getUnexported.mockRejectedValue(error);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });

      await expect(runJob()).rejects.toThrow("DB connection failed");

      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Hip Hop Driving Certificate Export Failed",
        }),
      );
    });
  });

  // ── Invalid submissions still trigger email ────────────────────────────

  describe("when all certificates have invalid/missing form data", () => {
    it("still sends the export email with invalid submissions sheet", async () => {
      const certWithNoForm = makeCertificate({
        userCourse: {
          id: 1,
          completedAt: new Date(),
          preCertificationFormSubmission: null,
        },
      });
      mockCertificateService.getUnexported.mockResolvedValue([certWithNoForm]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);

      await runJob();

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("Invalid Submissions"),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              content: expect.any(Buffer),
            }),
          ]),
        }),
      );
      // Invalid certs should NOT be marked as exported
      expect(mockCertificateService.markExported).not.toHaveBeenCalled();
    });
  });

  // ── Spreadsheet build failure ──────────────────────────────────────────

  describe("when spreadsheet generation fails", () => {
    it("sends failure email and re-throws", async () => {
      const cert = makeCertificate();
      mockCertificateService.getUnexported.mockResolvedValue([cert]);

      const { ExcelBuilder } = await import("@chronicstone/typed-xlsx");
      const excelError = new Error("Excel generation failed");
      vi.mocked(ExcelBuilder.create).mockImplementationOnce(() => {
        const sheetBuilder = {
          addTable: vi.fn(() => sheetBuilder),
          sheet: vi.fn(() => sheetBuilder),
          build: vi.fn(() => {
            throw excelError;
          }),
        };
        return { sheet: vi.fn(() => sheetBuilder) } as never;
      });

      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });

      await expect(runJob()).rejects.toThrow("Excel generation failed");

      expect(mockSentry.captureException).toHaveBeenCalledWith(excelError);
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Hip Hop Driving Certificate Export Failed",
          html: expect.stringContaining("Failed to generate the Excel spreadsheet"),
        }),
      );
    });
  });

  // ── Email send failure ─────────────────────────────────────────────────

  describe("when export email fails to send", () => {
    it("sends failure email and re-throws", async () => {
      const cert = makeCertificate();
      mockCertificateService.getUnexported.mockResolvedValue([cert]);
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);

      const emailError = new Error("SMTP failure");
      mockEmailService.send
        .mockRejectedValueOnce(emailError) // first call = export email fails
        .mockResolvedValueOnce({ messageId: "msg-1" }); // second call = failure notification

      await expect(runJob()).rejects.toThrow("SMTP failure");

      expect(mockSentry.captureException).toHaveBeenCalledWith(emailError);
      expect(mockEmailService.send).toHaveBeenCalledTimes(2);
      expect(mockEmailService.send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subject: "Hip Hop Driving Certificate Export Failed",
        }),
      );
    });
  });

  // ── Mark exported failure ──────────────────────────────────────────────

  describe("when marking certificates as exported fails", () => {
    it("sends failure email about duplicate risk and re-throws", async () => {
      const cert = makeCertificate();
      mockCertificateService.getUnexported.mockResolvedValue([cert]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);

      const dbError = new Error("Update failed");
      mockCertificateService.markExported.mockRejectedValue(dbError);

      await expect(runJob()).rejects.toThrow("Update failed");

      expect(mockSentry.captureException).toHaveBeenCalledWith(dbError);
      // Export email + failure notification
      expect(mockEmailService.send).toHaveBeenCalledTimes(2);
      expect(mockEmailService.send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("duplicate exports"),
        }),
      );
    });
  });

  // ── R2 upload ──────────────────────────────────────────────────────────

  describe("R2 upload", () => {
    it("uploads the report to R2 bucket", async () => {
      const cert = makeCertificate();
      mockCertificateService.getUnexported.mockResolvedValue([cert]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);
      mockCertificateService.markExported.mockResolvedValue(undefined);

      await runJob();

      expect(mockBucket.uploadFile).toHaveBeenCalledWith({
        key: expect.stringMatching(/^reports\/hiphop\/hiphop-driving-certificates-/),
        file: expect.any(Buffer),
      });
    });

    it("continues to send email even if R2 upload fails", async () => {
      const cert = makeCertificate();
      mockCertificateService.getUnexported.mockResolvedValue([cert]);
      mockBucket.uploadFile.mockRejectedValue(new Error("R2 failure"));
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockCertificateService.markExported.mockResolvedValue(undefined);

      await runJob();

      expect(mockSentry.captureException).toHaveBeenCalledWith(expect.any(Error));
      // Email still sent even after R2 failure
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Hip Hop Driving Certificate Export"),
          attachments: expect.any(Array),
        }),
      );
      expect(mockCertificateService.markExported).toHaveBeenCalled();
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("sends export email with attachment and marks certificates as exported", async () => {
      const cert = makeCertificate();
      mockCertificateService.getUnexported.mockResolvedValue([cert]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);
      mockCertificateService.markExported.mockResolvedValue(undefined);

      await runJob();

      // Export email sent with attachment
      expect(mockEmailService.send).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          subject: expect.stringContaining("Hip Hop Driving Certificate Export"),
          html: expect.stringContaining("1 valid certificate(s)"),
          attachments: [
            expect.objectContaining({
              filename: expect.stringContaining("hiphop-driving-certificates-"),
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              content: expect.any(Buffer),
            }),
          ],
        }),
      );

      // Certificates marked as exported
      expect(mockCertificateService.markExported).toHaveBeenCalledWith([cert.id]);
    });

    it("handles multiple certificates", async () => {
      const cert1 = makeCertificate({ id: 1, number: "CERT-001" });
      const cert2 = makeCertificate({ id: 2, number: "CERT-002" });
      mockCertificateService.getUnexported.mockResolvedValue([cert1, cert2]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);
      mockCertificateService.markExported.mockResolvedValue(undefined);

      await runJob();

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("2 valid certificate(s)"),
        }),
      );
      expect(mockCertificateService.markExported).toHaveBeenCalledWith([1, 2]);
    });

    it("only marks valid certificates as exported, still sends email with invalid sheet", async () => {
      const validCert = makeCertificate({ id: 1, number: "CERT-001" });
      const invalidCert = makeCertificate({
        id: 2,
        number: "CERT-002",
        userCourse: {
          id: 2,
          completedAt: new Date(),
          preCertificationFormSubmission: {
            formData: { invalid: "data" },
          },
        },
      });
      mockCertificateService.getUnexported.mockResolvedValue([validCert, invalidCert]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);
      mockCertificateService.markExported.mockResolvedValue(undefined);

      await runJob();

      // Email includes warning about invalid submissions
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("Invalid Submissions"),
        }),
      );
      // Only the valid cert is marked exported
      expect(mockCertificateService.markExported).toHaveBeenCalledWith([1]);
    });
  });
});

// ─── Unit tests for pure functions ───────────────────────────────────────────

describe("buildExportRows", () => {
  it("maps certificate data to the correct export row shape", () => {
    const cert = makeCertificate();
    const { rows, invalidRows } = buildExportRows([cert]);

    expect(rows).toHaveLength(1);
    expect(invalidRows).toHaveLength(0);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        certNumber: "CERT-001",
        cpLicenseNumber: "CP1198",
        deliveryMethod: "A",
        studentLastName: "Doe",
        studentFirstName: "John",
        studentMiddleInitial: "A",
        studentAddress: "123 Main St",
        studentCity: "Austin",
        studentState: "TX",
        studentZipCode: "78701",
        studentDlNumber: "DL123456",
        studentDlState: "TX",
        studentDateOfBirth: "01/15/1990",
        studentPhoneNumber: "555-1234",
        studentGender: "M",
        courtName: "Tarrant County",
        reasonCode: "T",
        voiceCode: "O",
        replacedCertNumber: "",
        voidCodeReason: "",
        voidCode12Description: "",
      }),
    );
  });

  it("formats completionDate and issueDate correctly", () => {
    const cert = makeCertificate({
      issuedAt: new Date("2026-03-03T12:00:00Z"),
      userCourse: {
        ...makeCertificate().userCourse,
        completedAt: new Date("2026-03-02T12:00:00Z"),
      },
    });
    const { rows } = buildExportRows([cert]);

    expect(rows[0]?.completionDate).toBe("03/02/2026");
    expect(rows[0]?.issueDate).toBe("03/03/2026");
  });

  it("adds certificate with missing form submission to invalidRows", () => {
    const cert = makeCertificate({
      userCourse: {
        ...makeCertificate().userCourse,
        preCertificationFormSubmission: null,
      },
    });
    const { rows, invalidRows } = buildExportRows([cert]);

    expect(rows).toHaveLength(0);
    expect(invalidRows).toHaveLength(1);
    expect(invalidRows[0]).toEqual(
      expect.objectContaining({
        certId: cert.id,
        certNumber: cert.number,
        reason: "Missing pre-certification form submission",
        rawFormData: "",
      }),
    );
  });

  it("adds certificate with invalid form data to invalidRows", () => {
    const cert = makeCertificate({
      userCourse: {
        ...makeCertificate().userCourse,
        preCertificationFormSubmission: {
          formData: { invalid: "data" },
        },
      },
    });
    const { rows, invalidRows } = buildExportRows([cert]);

    expect(rows).toHaveLength(0);
    expect(invalidRows).toHaveLength(1);
    expect(invalidRows[0]).toEqual(
      expect.objectContaining({
        certId: cert.id,
        certNumber: cert.number,
        reason: expect.stringContaining("Validation failed"),
        rawFormData: JSON.stringify({ invalid: "data" }),
      }),
    );
  });

  it("separates valid and invalid certificates correctly", () => {
    const validCert = makeCertificate({ id: 1, number: "CERT-001" });
    const invalidCert = makeCertificate({
      id: 2,
      number: "CERT-002",
      userCourse: {
        ...makeCertificate().userCourse,
        preCertificationFormSubmission: null,
      },
    });
    const { rows, invalidRows } = buildExportRows([validCert, invalidCert]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.certNumber).toBe("CERT-001");
    expect(invalidRows).toHaveLength(1);
    expect(invalidRows[0]?.certNumber).toBe("CERT-002");
  });

  it("uses empty string for courtName when not provided", () => {
    const formDataWithoutCourt = { ...validFormData, reasonCode: "I" as const };
    delete (formDataWithoutCourt as Record<string, unknown>).courtName;
    const cert = makeCertificate({
      userCourse: {
        ...makeCertificate().userCourse,
        preCertificationFormSubmission: {
          formData: formDataWithoutCourt,
        },
      },
    });
    const { rows } = buildExportRows([cert]);

    expect(rows[0]?.courtName).toBe("");
  });

  it("handles empty completedAt date", () => {
    const cert = makeCertificate({
      userCourse: {
        ...makeCertificate().userCourse,
        completedAt: null,
      },
    });
    const { rows } = buildExportRows([cert]);

    expect(rows[0]?.completionDate).toBe("");
  });
});

describe("buildSpreadsheet", () => {
  it("returns a Buffer", async () => {
    const result = await buildSpreadsheet([], []);
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
