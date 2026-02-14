import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/shared/error", () => ({
  isClerkAPIResponseError: vi.fn(),
}));

vi.mock("~/integrations/clerk.server", () => ({
  clerkClient: {
    users: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock("~/integrations/db.server", () => ({
  db: {
    $transaction: vi.fn(),
    userQuizProgress: { deleteMany: vi.fn() },
    userLessonProgress: { deleteMany: vi.fn() },
    userCourse: { deleteMany: vi.fn() },
  },
}));

vi.mock("~/services/user-course.server", () => ({
  UserCourseService: {
    getAllByUserId: vi.fn(),
  },
}));

vi.mock("~/services/payment.server", () => ({
  PaymentService: {
    upsertCustomer: vi.fn(),
  },
}));

vi.mock("~/services/auth.server", () => ({
  AuthService: {
    updatePublicMetadata: vi.fn(),
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { isClerkAPIResponseError } from "@clerk/shared/error";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { AuthService } from "~/services/auth.server";
import { PaymentService } from "~/services/payment.server";
import { UserCourseService } from "~/services/user-course.server";

import { UserService } from "./user.server";

const mockClerk = vi.mocked(clerkClient, true);
const mockDb = vi.mocked(db, true);
const mockIsClerkError = vi.mocked(isClerkAPIResponseError);

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getById", () => {
    it("returns combined user data from Clerk and UserCourseService", async () => {
      const clerkUser = {
        id: "user_1",
        firstName: "John",
        lastName: "Doe",
        primaryEmailAddress: { emailAddress: "john@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1234567890" },
        locked: false,
        publicMetadata: {},
      };
      const courses = [{ id: 1, courseId: "c1" }];
      mockClerk.users.getUser.mockResolvedValue(clerkUser as never);
      vi.mocked(UserCourseService.getAllByUserId).mockResolvedValue(courses as never);

      const result = await UserService.getById("user_1");
      expect(result).toEqual(
        expect.objectContaining({
          id: "user_1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          courses,
          isActive: true,
        }),
      );
    });

    it("returns null when Clerk returns 404", async () => {
      const error = { status: 404 };
      mockClerk.users.getUser.mockRejectedValue(error);
      mockIsClerkError.mockReturnValue(true);

      const result = await UserService.getById("user_missing");
      expect(result).toBeNull();
    });

    it("rethrows non-404 errors", async () => {
      const error = new Error("Server error");
      mockClerk.users.getUser.mockRejectedValue(error);
      mockIsClerkError.mockReturnValue(false);

      await expect(UserService.getById("user_1")).rejects.toThrow("Server error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("linkToStripe", () => {
    it("creates a stripe customer and updates metadata", async () => {
      vi.mocked(PaymentService.upsertCustomer).mockResolvedValue({ id: "cus_123" });
      vi.mocked(AuthService.updatePublicMetadata).mockResolvedValue({ id: "user_1" } as never);

      const result = await UserService.linkToStripe("user_1");
      expect(result).toEqual({ id: "user_1" });
      expect(vi.mocked(PaymentService.upsertCustomer)).toHaveBeenCalledWith("user_1");
      expect(vi.mocked(AuthService.updatePublicMetadata)).toHaveBeenCalledWith(
        "user_1",
        expect.objectContaining({ stripeCustomerId: "cus_123" }),
      );
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("Stripe error");
      vi.mocked(PaymentService.upsertCustomer).mockRejectedValue(error);

      await expect(UserService.linkToStripe("user_1")).rejects.toThrow("Stripe error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("delete", () => {
    it("runs a transaction to delete all user data", async () => {
      mockDb.$transaction.mockResolvedValue([{ count: 1 }, { count: 2 }, { count: 1 }] as never);

      await UserService.delete("user_1");
      expect(mockDb.$transaction).toHaveBeenCalledWith([
        mockDb.userQuizProgress.deleteMany({ where: { userId: "user_1" } }),
        mockDb.userLessonProgress.deleteMany({ where: { userId: "user_1" } }),
        mockDb.userCourse.deleteMany({ where: { userId: "user_1" } }),
      ]);
    });

    it("propagates transaction errors", async () => {
      const error = new Error("Transaction error");
      mockDb.$transaction.mockRejectedValue(error);

      await expect(UserService.delete("user_1")).rejects.toThrow("Transaction error");
    });
  });
});
