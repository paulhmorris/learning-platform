import { clerkClient as client } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";

export const AuthService = {
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

  linkOAuthUserToExistingUser(email: string, clerkId: string) {
    return db.user.update({
      select: { id: true },
      where: { email },
      data: { clerkId },
    });
  },
};
