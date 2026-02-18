import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/stripe.server", () => ({
  stripe: {
    customers: {
      search: vi.fn(),
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("~/services/auth.server", () => ({
  AuthService: {
    updatePublicMetadata: vi.fn(),
  },
}));

vi.mock("~/services/user.server", () => ({
  UserService: {
    getById: vi.fn(),
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn(), captureMessage: vi.fn() },
}));

import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

import { PaymentService } from "./payment.server";

const mockStripe = vi.mocked(stripe, true);
const mockUser = vi.mocked(UserService, true);
const mockAuth = vi.mocked(AuthService, true);

const fakeUser = {
  id: "user_abc123",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "+1234567890",
  publicMetadata: { stripeCustomerId: undefined },
};

describe("PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("upsertCustomer", () => {
    it("throws when user not found", async () => {
      mockUser.getById.mockResolvedValue(null);

      await expect(PaymentService.upsertCustomer("user_1")).rejects.toThrow("User not found");
    });

    it("throws on invalid user ID format", async () => {
      mockUser.getById.mockResolvedValue(fakeUser as never);

      await expect(PaymentService.upsertCustomer("user;drop table")).rejects.toThrow("Invalid user ID format");
    });

    it("returns existing customer when found", async () => {
      mockUser.getById.mockResolvedValue(fakeUser as never);
      mockStripe.customers.search.mockResolvedValue({
        data: [{ id: "cus_existing" }],
      } as never);
      mockAuth.updatePublicMetadata.mockResolvedValue({} as never);

      const result = await PaymentService.upsertCustomer("user_abc123");
      expect(result).toEqual({ id: "cus_existing" });
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it("warns on multiple existing customers", async () => {
      mockUser.getById.mockResolvedValue(fakeUser as never);
      mockStripe.customers.search.mockResolvedValue({
        data: [{ id: "cus_1" }, { id: "cus_2" }],
      } as never);
      mockAuth.updatePublicMetadata.mockResolvedValue({} as never);

      await PaymentService.upsertCustomer("user_abc123");
      expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalledWith(
        expect.stringContaining("Multiple Stripe customers"),
        expect.any(Object),
      );
    });

    it("creates a new customer when none exists", async () => {
      mockUser.getById.mockResolvedValue(fakeUser as never);
      mockStripe.customers.search.mockResolvedValue({ data: [] } as never);
      mockStripe.customers.create.mockResolvedValue({ id: "cus_new" } as never);
      mockAuth.updatePublicMetadata.mockResolvedValue({} as never);

      const result = await PaymentService.upsertCustomer("user_abc123");
      expect(result).toEqual({ id: "cus_new" });
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "John Doe",
          email: "john@example.com",
          metadata: expect.objectContaining({ user_id: "user_abc123" }),
        }),
        expect.objectContaining({ idempotencyKey: "customer_create_user_abc123" }),
      );
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("Stripe error");
      mockUser.getById.mockRejectedValue(error);

      await expect(PaymentService.upsertCustomer("user_abc123")).rejects.toThrow("Stripe error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe("createCourseCheckoutSession", () => {
    it("creates a checkout session with existing stripe customer", async () => {
      const userWithStripe = { ...fakeUser, publicMetadata: { stripeCustomerId: "cus_existing" } };
      mockUser.getById.mockResolvedValue(userWithStripe as never);
      const session = { id: "cs_123", url: "https://checkout.stripe.com" };
      mockStripe.checkout.sessions.create.mockResolvedValue(session as never);

      const result = await PaymentService.createCourseCheckoutSession({
        userId: "user_abc123",
        stripePriceId: "price_123",
        baseUrl: "https://example.com",
      });
      expect(result).toEqual(session);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing",
          mode: "payment",
          line_items: [{ price: "price_123", quantity: 1 }],
        }),
        expect.objectContaining({
          idempotencyKey: "checkout_session_user_abc123_price_123",
        }),
      );
    });

    it("throws when user not found", async () => {
      mockUser.getById.mockResolvedValue(null);

      await expect(
        PaymentService.createCourseCheckoutSession({
          userId: "user_1",
          stripePriceId: "price_1",
          baseUrl: "https://example.com",
        }),
      ).rejects.toThrow("User not found");
    });
  });
});
