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
    const { client_secret } = await IdentityService.retrieveVerificationSession(user.stripeVerificationSessionId);
    return { client_secret };
  }

  try {
    const { client_secret } = await IdentityService.createVerificationSession(user.id, user.email);
    return { client_secret };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Responses.serverError();
  }
}
