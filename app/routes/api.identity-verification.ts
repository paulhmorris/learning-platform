import { ActionFunctionArgs } from "react-router";

import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { IdentityService } from "~/services/identity.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Api.IdentityVerification");

// POST or PUT /api/identity-verification
export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);

  if (user.isIdentityVerified) {
    logger.info(`User ${user.id} is already identity verified`);
    return Responses.conflict();
  }

  if (user.stripeVerificationSessionId) {
    const session = await IdentityService.retrieveVerificationSession(user.stripeVerificationSessionId);
    logger.info(
      `Retrieved existing identity verification session for user ${user.id} status=${session.status} id=${session.id} lastErrorCode=${session.last_error?.code}`,
    );

    if (session.status === "verified") {
      return Responses.conflict();
    }

    const lastErrorCode = session.last_error?.code ?? null;
    const shouldRetry =
      session.status === "canceled" ||
      (session.status === "requires_input" && (lastErrorCode === "consent_declined" || lastErrorCode === "abandoned"));

    if (!shouldRetry && session.client_secret) {
      return Responses.ok({ client_secret: session.client_secret });
    }
  }

  try {
    logger.info(`Creating new identity verification session for user ${user.id}`);
    const _session = await IdentityService.createVerificationSession(user.id, user.email);
    logger.info(`Created identity verification session for user ${user.id} with id ${_session.id}`);
    return Responses.ok({ client_secret: _session.client_secret });
  } catch (error) {
    logger.error(error instanceof Error ? error.message : "Unknown error");
    Sentry.captureException(error);
    return Responses.serverError();
  }
}
