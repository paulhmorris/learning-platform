import { clerkClient as client } from "~/integrations/clerk.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("AuthService");

export const AuthService = {
  async getUserList(args: Parameters<typeof client.users.getUserList>[0] = {}) {
    try {
      return await client.users.getUserList(args);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get user list", { error, args });
      throw error;
    }
  },

  async getInvitationsByEmail(email: string) {
    try {
      const { data } = await client.invitations.getInvitationList({ query: email });
      return data;
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to get invitations by email", { error, email });
      throw error;
    }
  },

  async revokeSession(sessionId: string) {
    try {
      return await client.sessions.revokeSession(sessionId);
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to revoke session", { error, sessionId });
      throw error;
    }
  },

  async saveExternalId(clerkId: string, externalId: string) {
    try {
      return await client.users.updateUser(clerkId, { externalId });
    } catch (error) {
      Sentry.captureException(error);
      logger.error("Failed to save external ID", { error, clerkId, externalId });
      throw error;
    }
  },
};
