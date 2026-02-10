import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/stripe.server", () => ({
  stripe: {
    identity: {
      verificationSessions: {
        create: vi.fn(),
        retrieve: vi.fn(),
      },
    },
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

import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { AuthService } from "~/services/auth.server";

import { IdentityService } from "./identity.server";

const mockStripe = vi.mocked(stripe, true);
const mockAuth = vi.mocked(AuthService, true);

describe("IdentityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createVerificationSession", () => {
    it("creates a Stripe verification session and updates metadata", async () => {
      const session = { id: "vs_123" };
      mockStripe.identity.verificationSessions.create.mockResolvedValue(session as never);
      mockAuth.updatePublicMetadata.mockResolvedValue({} as never);

      const result = await IdentityService.createVerificationSession("user_1", "test@example.com");
      expect(result).toEqual(session);
      expect(mockStripe.identity.verificationSessions.create).toHaveBeenCalledWith({
        type: "document",
        provided_details: { email: "test@example.com" },
        metadata: { user_id: "user_1" },
      });
      expect(mockAuth.updatePublicMetadata).toHaveBeenCalledWith("user_1", {
        stripeVerificationSessionId: "vs_123",
      });
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("Stripe error");
      mockStripe.identity.verificationSessions.create.mockRejectedValue(error);

      await expect(IdentityService.createVerificationSession("user_1", "a@b.com")).rejects.toThrow("Stripe error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error, expect.any(Object));
    });
  });

  describe("retrieveVerificationSession", () => {
    it("retrieves a verification session from Stripe", async () => {
      const session = { id: "vs_123", status: "verified" };
      mockStripe.identity.verificationSessions.retrieve.mockResolvedValue(session as never);

      const result = await IdentityService.retrieveVerificationSession("vs_123");
      expect(result).toEqual(session);
      expect(mockStripe.identity.verificationSessions.retrieve).toHaveBeenCalledWith("vs_123");
    });

    it("propagates errors from Stripe", async () => {
      const error = new Error("Not found");
      mockStripe.identity.verificationSessions.retrieve.mockRejectedValue(error);

      await expect(IdentityService.retrieveVerificationSession("vs_bad")).rejects.toThrow("Not found");
    });
  });
});
