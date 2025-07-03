import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("IdentityService");

export type VerificationSession = Awaited<ReturnType<typeof IdentityService.retrieveVerificationSession>>;

export const IdentityService = {
  async createVerificationSession(userId: string, email: string) {
    try {
      const verificationSession = await stripe.identity.verificationSessions.create({
        type: "document",
        provided_details: { email },
        metadata: { user_id: userId },
      });
      await UserService.update(userId, { stripeVerificationSessionId: verificationSession.id });
      logger.info({ userId, email, sessionId: verificationSession.id }, "Created verification session");
      return verificationSession;
    } catch (error) {
      Sentry.captureException(error, { extra: { userId, email } });
      logger.error({ userId, email, error }, "Failed to create verification session");
      throw error;
    }
  },

  async retrieveVerificationSession(sessionId: string) {
    try {
      logger.debug({ sessionId }, "Retrieving verification session");
      return stripe.identity.verificationSessions.retrieve(sessionId);
    } catch (error) {
      Sentry.captureException(error, { extra: { sessionId } });
      logger.error({ sessionId, error }, "Failed to retrieve verification session");
      throw error;
    }
  },
};
