import { ActionFunctionArgs } from "react-router";

import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { IdentityService } from "~/services/identity.server";
import { SessionService } from "~/services/session.server";

// POST or PUT /api/identity-verification
export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);

  if (user.isIdentityVerified) {
    return Responses.conflict();
  }

  if (user.stripeVerificationSessionId) {
    const session = await IdentityService.retrieveVerificationSession(user.stripeVerificationSessionId);

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
    // TODO: Clerk migration
    const { client_secret } = await IdentityService.createVerificationSession(user.clerkId!, user.email);
    return Responses.ok({ client_secret });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Responses.serverError();
  }
}
