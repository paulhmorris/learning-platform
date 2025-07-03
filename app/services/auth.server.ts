import { clerkClient as client } from "~/integrations/clerk.server";

export const AuthService = {
  async getUserList(args: Parameters<typeof client.users.getUserList>[0] = {}) {
    return client.users.getUserList(args);
  },

  async getInvitationsByEmail(email: string) {
    const { data } = await client.invitations.getInvitationList({ query: email });
    return data;
  },

  async revokeSession(sessionId: string) {
    return client.sessions.revokeSession(sessionId);
  },

  async saveExternalId(clerkId: string, externalId: string) {
    return client.users.updateUser(clerkId, { externalId });
  },
};
