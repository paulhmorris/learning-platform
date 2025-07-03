import { clerkClient as client } from "~/integrations/clerk.server";
import { Sentry } from "~/integrations/sentry";

export const AuthService = {
  async getUserList(args: Parameters<typeof client.users.getUserList>[0] = {}) {
    try {
      const list = await client.users.getUserList(args);
      return list;
    } catch (error) {
      Sentry.captureException(error);
      console.error("Error fetching user list:", error);
      throw error;
    }
  },

  async getInvitationsByEmail(email: string) {
    try {
      const invitations = await client.invitations.getInvitationList({ query: email });
      return invitations.data;
    } catch (error) {
      Sentry.captureException(error, { extra: { email } });
      console.error(`Error fetching invitation for email ${email}:`, error);
      throw error;
    }
  },

  async revokeSession(sessionId: string) {
    try {
      const revokedSession = await client.sessions.revokeSession(sessionId);
      console.info(`Session ${sessionId} revoked successfully`);
      return revokedSession;
    } catch (error) {
      Sentry.captureException(error, { extra: { sessionId } });
      console.error(`Error revoking session ${sessionId}:`, error);
      throw error;
    }
  },
};
