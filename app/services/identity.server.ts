import { stripe } from "~/integrations/stripe.server";
import { UserService } from "~/services/user.server";

export type VerificationSession = Awaited<ReturnType<typeof IdentityService.retrieveVerificationSession>>;

export const IdentityService = {
  async createVerificationSession(userId: string, email: string) {
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      provided_details: { email },
      metadata: { user_id: userId },
    });

    await UserService.update(userId, { stripeVerificationSessionId: verificationSession.id });
    return verificationSession;
  },

  async retrieveVerificationSession(sessionId: string) {
    return stripe.identity.verificationSessions.retrieve(sessionId);
  },
};
