import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@napi-rs/canvas", () => {
  const mockCtx = {
    drawImage: vi.fn(),
    fillText: vi.fn(),
    textAlign: "",
    font: "",
  };
  const mockCanvas = {
    getContext: vi.fn(() => mockCtx),
    toBuffer: vi.fn(() => Buffer.from("fake-png")),
  };
  return {
    createCanvas: vi.fn(() => mockCanvas),
    loadImage: vi.fn(() => Promise.resolve({ width: 1650, height: 1275 })),
    Canvas: vi.fn(),
  };
});

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  task: vi.fn((opts: { id: string; run: (...args: Array<unknown>) => unknown }) => opts),
}));

vi.mock("~/integrations/db.server", () => ({
  db: {
    preCertificationFormSubmission: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("~/integrations/bucket.server", () => ({
  Bucket: { uploadFile: vi.fn() },
}));

vi.mock("~/integrations/email.server", () => ({
  EmailService: { send: vi.fn() },
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn(), captureMessage: vi.fn() },
}));

vi.mock("~/services/certificate.server", () => ({
  CertificateService: {
    getNextAllocationForCourse: vi.fn(),
    getRemainingAllocationsCount: vi.fn(),
    createAndUpdateCourse: vi.fn(),
  },
}));

vi.mock("~/services/user-course.server", () => ({
  UserCourseService: { getAllByUserId: vi.fn() },
}));

vi.mock("~/services/user.server", () => ({
  UserService: { getById: vi.fn() },
}));

vi.mock("~/config", () => ({
  CONFIG: { supportEmail: "help@test.com" },
}));

vi.mock("~/config.server", () => ({
  SERVER_CONFIG: { emailFromDomain: "test.com" },
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

import { loadImage } from "@napi-rs/canvas";

import { Bucket } from "~/integrations/bucket.server";
import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { CertificateService } from "~/services/certificate.server";
import { UserCourseService } from "~/services/user-course.server";
import { UserService } from "~/services/user.server";

import { claimCertificateJob } from "./claim-certificate";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockUserService = vi.mocked(UserService);
const mockUserCourseService = vi.mocked(UserCourseService);
const mockCertificateService = vi.mocked(CertificateService);
const mockEmailService = vi.mocked(EmailService);
const mockBucket = vi.mocked(Bucket);
const mockDb = vi.mocked(db, true);
const mockSentry = vi.mocked(Sentry);
const mockLoadImage = vi.mocked(loadImage);

// task() mock returns the raw options object, so we cast to access .run
const runJob = (
  claimCertificateJob as unknown as {
    run: (payload: { userId: string; courseId: string; courseName: string }) => Promise<void>;
  }
).run;

const KNOWN_COURSE_ID = "cmj3fal250001sbom8cjbvh8y";
const UNKNOWN_COURSE_ID = "unknown-course-id";

const defaultPayload = {
  userId: "user_123",
  courseId: KNOWN_COURSE_ID,
  courseName: "Hip Hop Driving",
};

type MockUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | undefined;
  isActive: boolean;
  publicMetadata: UserPublicMetadata;
  courses: Array<{
    id: number;
    courseId: string;
    isCompleted: boolean;
    completedAt: Date | null;
    createdAt: Date;
    certificate: { id: number; s3Key: string | null; issuedAt: Date } | null;
    course: { strapiId: number };
  }>;
};

function makeUser(overrides?: Partial<MockUser>) {
  return {
    id: "user_123",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: undefined,
    isActive: true,
    publicMetadata: {} as UserPublicMetadata,
    courses: [],
    ...overrides,
  };
}

function makeUserCourse(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    courseId: KNOWN_COURSE_ID,
    isCompleted: true,
    completedAt: new Date("2025-06-15"),
    createdAt: new Date(),
    certificate: null,
    course: { strapiId: 1 },
    ...overrides,
  };
}

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
  reasonCode: "I" as const,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
  // Re-apply default mock implementations after restoreAllMocks
  mockLoadImage.mockResolvedValue({ width: 1650, height: 1275 } as never);
});

describe("claimCertificateJob", () => {
  it("has the correct task id", () => {
    expect(claimCertificateJob.id).toBe("claim-certificate");
  });

  // ── User validation ──────────────────────────────────────────────────────

  describe("user validation", () => {
    it("throws when user is not found", async () => {
      mockUserService.getById.mockResolvedValue(null);

      await expect(runJob(defaultPayload)).rejects.toThrow("User not found in Clerk");
    });

    it("throws when user has no email", async () => {
      mockUserService.getById.mockResolvedValue(makeUser({ email: "" }));

      await expect(runJob(defaultPayload)).rejects.toThrow("User does not have an email address");
    });
  });

  // ── Course validation ────────────────────────────────────────────────────

  describe("course validation", () => {
    it("throws when user is not enrolled in the course", async () => {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([]);

      await expect(runJob(defaultPayload)).rejects.toThrow("User has not completed this course");
    });

    it("throws when user has different courses but not the requested one", async () => {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([
        makeUserCourse({ courseId: "different-course-id" }) as never,
      ]);

      await expect(runJob(defaultPayload)).rejects.toThrow("User has not completed this course");
    });
  });

  // ── Already claimed ──────────────────────────────────────────────────────

  describe("certificate already claimed", () => {
    it("sends another email with existing certificate and returns early", async () => {
      const userCourse = makeUserCourse({
        certificate: { id: 1, issuedAt: new Date(), s3Key: "certs/old.png" },
      });
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([userCourse as never]);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });

      await runJob(defaultPayload);

      expect(mockEmailService.send).toHaveBeenCalledOnce();
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "View Your Certificate!",
          to: "john@example.com",
        }),
      );
      // Should NOT touch allocations or S3
      expect(mockCertificateService.getNextAllocationForCourse).not.toHaveBeenCalled();
      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });
  });

  // ── Business checks ──────────────────────────────────────────────────────

  describe("business checks", () => {
    it("throws when business checks fail for known course", async () => {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([makeUserCourse() as never]);
      mockDb.preCertificationFormSubmission.count.mockResolvedValue(0);

      await expect(runJob(defaultPayload)).rejects.toThrow("Certificate generation function is lacking requirements");
    });

    it("skips business checks for unknown course IDs", async () => {
      const payload = { ...defaultPayload, courseId: UNKNOWN_COURSE_ID };
      const userCourse = makeUserCourse({ courseId: UNKNOWN_COURSE_ID });
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([userCourse as never]);
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue(null);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });

      // Should get past business checks and hit the allocation check
      await runJob(payload);

      expect(mockDb.preCertificationFormSubmission.count).not.toHaveBeenCalled();
      expect(mockCertificateService.getNextAllocationForCourse).toHaveBeenCalledWith(UNKNOWN_COURSE_ID);
    });
  });

  // ── Allocations ──────────────────────────────────────────────────────────

  describe("allocation handling", () => {
    it("sends error email and reports to Sentry when no allocations available", async () => {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([makeUserCourse() as never]);
      mockDb.preCertificationFormSubmission.count.mockResolvedValue(1);
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue(null);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });

      await runJob(defaultPayload);

      expect(mockSentry.captureMessage).toHaveBeenCalledWith(
        "No certificate allocations available",
        expect.objectContaining({ extra: expect.objectContaining({ courseId: KNOWN_COURSE_ID }) }),
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "There was an issue creating your certificate!",
        }),
      );
      // Should not attempt to create certificate
      expect(mockCertificateService.createAndUpdateCourse).not.toHaveBeenCalled();
    });
  });

  // ── Certificate record creation ──────────────────────────────────────────

  describe("certificate record creation", () => {
    it("returns early and reports to Sentry when createAndUpdateCourse throws", async () => {
      const error = new Error("DB write failed");
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([makeUserCourse() as never]);
      mockDb.preCertificationFormSubmission.count.mockResolvedValue(1);
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue({
        id: 1,
        number: "CERT-001",
        isUsed: true,
        courseId: KNOWN_COURSE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCertificateService.createAndUpdateCourse.mockRejectedValue(error);

      await runJob(defaultPayload);

      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });

    it("returns early and reports to Sentry when certificate number is missing from response", async () => {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([makeUserCourse() as never]);
      mockDb.preCertificationFormSubmission.count.mockResolvedValue(1);
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue({
        id: 1,
        number: "CERT-001",
        isUsed: true,
        courseId: KNOWN_COURSE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCertificateService.createAndUpdateCourse.mockResolvedValue({
        id: 1,
        certificate: null,
      });

      await runJob(defaultPayload);

      expect(mockSentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Certificate record created but number is missing" }),
      );
      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });
  });

  // ── Canvas generation ────────────────────────────────────────────────────

  describe("canvas generation", () => {
    function setupHappyPath() {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([makeUserCourse() as never]);
      mockDb.preCertificationFormSubmission.count.mockResolvedValue(1);
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue({
        id: 1,
        number: "CERT-001",
        isUsed: true,
        courseId: KNOWN_COURSE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCertificateService.createAndUpdateCourse.mockResolvedValue({
        id: 1,
        certificate: { number: "CERT-001" },
      });
    }

    it("returns early when no canvas function exists for the course", async () => {
      const payload = { ...defaultPayload, courseId: UNKNOWN_COURSE_ID };
      const userCourse = makeUserCourse({ courseId: UNKNOWN_COURSE_ID });
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([userCourse as never]);
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue({
        id: 1,
        number: "CERT-001",
        isUsed: true,
        courseId: UNKNOWN_COURSE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCertificateService.createAndUpdateCourse.mockResolvedValue({
        id: 1,
        certificate: { number: "CERT-001" },
      });

      await runJob(payload);

      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });

    it("returns early and reports to Sentry when form submission is missing", async () => {
      setupHappyPath();
      mockDb.preCertificationFormSubmission.findFirst.mockResolvedValue(null);

      await runJob(defaultPayload);

      expect(mockSentry.captureMessage).toHaveBeenCalledWith(
        "Certificate canvas generation failed after allocation was consumed",
        expect.objectContaining({ extra: expect.objectContaining({ userCourseId: 1 }) }),
      );
      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });

    it("returns early when form data fails validation", async () => {
      setupHappyPath();
      mockDb.preCertificationFormSubmission.findFirst.mockResolvedValue({
        id: 1,
        userCourseId: 1,
        formData: { invalid: "data" },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await runJob(defaultPayload);

      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });

    it("returns early when certificate base image fails to load", async () => {
      setupHappyPath();
      mockDb.preCertificationFormSubmission.findFirst.mockResolvedValue({
        id: 1,
        userCourseId: 1,
        formData: validFormData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockLoadImage.mockRejectedValue(new Error("Network error"));

      await runJob(defaultPayload);

      expect(mockBucket.uploadFile).not.toHaveBeenCalled();
    });
  });

  // ── Full happy path ──────────────────────────────────────────────────────

  describe("happy path", () => {
    function setupFullHappyPath() {
      mockUserService.getById.mockResolvedValue(makeUser());
      mockUserCourseService.getAllByUserId.mockResolvedValue([makeUserCourse() as never]);
      mockDb.preCertificationFormSubmission.count.mockResolvedValue(1);
      mockDb.preCertificationFormSubmission.findFirst.mockResolvedValue({
        id: 1,
        userCourseId: 1,
        formData: validFormData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCertificateService.getNextAllocationForCourse.mockResolvedValue({
        id: 1,
        number: "CERT-001",
        isUsed: true,
        courseId: KNOWN_COURSE_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockCertificateService.createAndUpdateCourse.mockResolvedValue({
        id: 1,
        certificate: { number: "CERT-001" },
      });
      mockBucket.uploadFile.mockResolvedValue({ $metadata: { httpStatusCode: 200 } } as never);
      mockEmailService.send.mockResolvedValue({ messageId: "msg-1" });
    }

    it("uploads certificate to S3 and sends success email", async () => {
      setupFullHappyPath();

      await runJob(defaultPayload);

      expect(mockBucket.uploadFile).toHaveBeenCalledOnce();
      expect(mockBucket.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringContaining("certificates/hip-hop-driving/"),
          file: expect.any(Buffer),
        }),
      );
      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Your certificate is ready!",
          to: "john@example.com",
        }),
      );
    });

    it("creates certificate record with correct allocation number", async () => {
      setupFullHappyPath();

      await runJob(defaultPayload);

      expect(mockCertificateService.createAndUpdateCourse).toHaveBeenCalledWith(
        expect.objectContaining({
          number: "CERT-001",
          userCourseId: 1,
          s3Key: expect.stringContaining("certificates/hip-hop-driving/"),
        }),
      );
    });

    it("generates S3 key with sanitized course name", async () => {
      setupFullHappyPath();

      await runJob({ ...defaultPayload, courseName: "Hip Hop Driving!!!" });

      expect(mockBucket.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.stringMatching(/^certificates\/hip-hop-driving\/\d{4}\/\d{1,2}\/\d{1,2}\/user_123-\d+\.png$/),
        }),
      );
    });

    it("reports to Sentry when S3 upload fails", async () => {
      setupFullHappyPath();
      const error = new Error("S3 error");
      mockBucket.uploadFile.mockRejectedValue(error);

      await runJob(defaultPayload);

      expect(mockSentry.captureException).toHaveBeenCalledWith(error);
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });
});
