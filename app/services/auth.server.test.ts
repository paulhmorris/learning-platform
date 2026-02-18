import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/integrations/clerk.server", () => ({
  clerkClient: {
    users: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
      getUserList: vi.fn(),
      updateUserMetadata: vi.fn(),
    },
    invitations: {
      getInvitationList: vi.fn(),
    },
    sessions: {
      revokeSession: vi.fn(),
    },
  },
}));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() }),
}));

vi.mock("~/integrations/sentry", () => ({
  Sentry: { captureException: vi.fn() },
}));

import { clerkClient } from "~/integrations/clerk.server";
import { Sentry } from "~/integrations/sentry";

import { AuthService } from "./auth.server";

const mockClerk = vi.mocked(clerkClient, true);

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("delegates to clerkClient.users.createUser", async () => {
      const args = { emailAddress: ["test@example.com"], firstName: "John" } as Parameters<
        typeof clerkClient.users.createUser
      >[0];
      const fakeUser = { id: "user_1" };
      mockClerk.users.createUser.mockResolvedValue(fakeUser as never);

      const result = await AuthService.createUser(args);
      expect(mockClerk.users.createUser).toHaveBeenCalledWith(args);
      expect(result).toEqual(fakeUser);
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("Clerk error");
      mockClerk.users.createUser.mockRejectedValue(error);

      await expect(AuthService.createUser({} as never)).rejects.toThrow("Clerk error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteUser", () => {
    it("delegates to clerkClient.users.deleteUser", async () => {
      const fakeResult = { id: "user_1", deleted: true };
      mockClerk.users.deleteUser.mockResolvedValue(fakeResult as never);

      const result = await AuthService.deleteUser("user_1");
      expect(mockClerk.users.deleteUser).toHaveBeenCalledWith("user_1");
      expect(result).toEqual(fakeResult);
    });

    it("captures exception and rethrows on failure", async () => {
      const error = new Error("Delete error");
      mockClerk.users.deleteUser.mockRejectedValue(error);

      await expect(AuthService.deleteUser("user_1")).rejects.toThrow("Delete error");
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
    });
  });

  describe("getUserList", () => {
    it("delegates to clerkClient.users.getUserList with default args", async () => {
      mockClerk.users.getUserList.mockResolvedValue({ data: [] } as never);

      await AuthService.getUserList();
      expect(mockClerk.users.getUserList).toHaveBeenCalledWith({});
    });
  });

  describe("getInvitationsByEmail", () => {
    it("returns invitation data for a given email", async () => {
      const invitations = [{ id: "inv_1" }];
      mockClerk.invitations.getInvitationList.mockResolvedValue({ data: invitations } as never);

      const result = await AuthService.getInvitationsByEmail("test@example.com");
      expect(mockClerk.invitations.getInvitationList).toHaveBeenCalledWith({ query: "test@example.com" });
      expect(result).toEqual(invitations);
    });
  });

  describe("revokeSession", () => {
    it("delegates to clerkClient.sessions.revokeSession", async () => {
      const fakeSession = { id: "sess_1" };
      mockClerk.sessions.revokeSession.mockResolvedValue(fakeSession as never);

      const result = await AuthService.revokeSession("sess_1");
      expect(result).toEqual(fakeSession);
    });
  });

  describe("updatePublicMetadata", () => {
    it("updates public metadata for a user", async () => {
      const metadata = { stripeCustomerId: "cus_1" } as UserPublicMetadata;
      mockClerk.users.updateUserMetadata.mockResolvedValue({ id: "user_1" } as never);

      await AuthService.updatePublicMetadata("user_1", metadata);
      expect(mockClerk.users.updateUserMetadata).toHaveBeenCalledWith("user_1", { publicMetadata: metadata });
    });
  });

  describe("updatePrivateMetadata", () => {
    it("updates private metadata for a user", async () => {
      const metadata = {} as UserPrivateMetadata;
      mockClerk.users.updateUserMetadata.mockResolvedValue({ id: "user_1" } as never);

      await AuthService.updatePrivateMetadata("user_1", metadata);
      expect(mockClerk.users.updateUserMetadata).toHaveBeenCalledWith("user_1", { privateMetadata: metadata });
    });
  });
});
