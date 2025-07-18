import { clerkClient as client } from "~/integrations/clerk.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";

const logger = createLogger("AuthService");

export const AuthService = {
  async getUserList(args: Parameters<typeof client.users.getUserList>[0] = {}) {
    try {
      return client.users.getUserList(args);
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error, args }, "Failed to get user list");
      throw error;
    }
  },

  async getInvitationsByEmail(email: string) {
    try {
      const { data } = await client.invitations.getInvitationList({ query: email });
      return data;
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error, email }, "Failed to get invitations by email");
      throw error;
    }
  },

  async revokeSession(sessionId: string) {
    try {
      return client.sessions.revokeSession(sessionId);
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error, sessionId }, "Failed to revoke session");
      throw error;
    }
  },

  async saveExternalId(clerkId: string, externalId: string) {
    try {
      return client.users.updateUser(clerkId, { externalId });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error, clerkId, externalId }, "Failed to save external ID");
      throw error;
    }
  },
};
