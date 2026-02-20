import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { AuthService } from "~/services/auth.server";

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
      await AuthService.updatePublicMetadata(userId, { stripeVerificationSessionId: verificationSession.id });
      logger.info(`Created verification session ${verificationSession.id} (${email})`, { userId });
      return verificationSession;
    } catch (error) {
      Sentry.captureException(error, { extra: { userId, email } });
      logger.error(`Failed to create verification session (${email})`, { error, userId });
      throw error;
    }
  },

  async retrieveVerificationSession(sessionId: string) {
    try {
      logger.debug(`Retrieving verification session ${sessionId}`);
      return stripe.identity.verificationSessions.retrieve(sessionId);
    } catch (error) {
      Sentry.captureException(error, { extra: { sessionId } });
      logger.error(`Failed to retrieve verification session ${sessionId}`, { error });
      throw error;
    }
  },
};
