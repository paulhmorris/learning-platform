import { clerkClient as client } from "~/integrations/clerk.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("AuthService");

export const AuthService = {
  async createUser(args: Parameters<typeof client.users.createUser>[0]) {
    try {
      return await client.users.createUser(args);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to create user", { error });
      throw error;
    }
  },

  async deleteUser(userId: string) {
    try {
      return await client.users.deleteUser(userId);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to delete user ${userId}`, { error });
      throw error;
    }
  },
  async getUserList(args: Parameters<typeof client.users.getUserList>[0] = {}) {
    try {
      return await client.users.getUserList(args);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get user list", { error });
      throw error;
    }
  },

  async getInvitationsByEmail(email: string) {
    try {
      const { data } = await client.invitations.getInvitationList({ query: email });
      return data;
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to get invitations by email ${email}`, { error });
      throw error;
    }
  },

  async revokeSession(sessionId: string) {
    try {
      return await client.sessions.revokeSession(sessionId);
    } catch (error) {
      Sentry.captureException(error);
      logger.error(`Failed to revoke session ${sessionId}`, { error });
      throw error;
    }
  },

  async updatePublicMetadata(clerkId: string, metadata: UserPublicMetadata) {
    try {
      return await client.users.updateUserMetadata(clerkId, { publicMetadata: metadata });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to update public metadata", { error, clerkId, metadata });
      throw error;
    }
  },

  async updatePrivateMetadata(clerkId: string, metadata: UserPrivateMetadata) {
    try {
      return await client.users.updateUserMetadata(clerkId, { privateMetadata: metadata });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to update private metadata", { error, clerkId, metadata });
      throw error;
    }
  },
};
