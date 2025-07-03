import { User } from "@prisma/client";
import { ActionFunctionArgs, data } from "react-router";

import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { SessionService } from "~/services/session.server";
import { UserService } from "~/services/user.server";

// POST or PUT /api/identity-verification
export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);

  if (user.isIdentityVerified) {
    return new Response("User is already verified or has an active session", { status: 400 });
  }

  if (user.stripeVerificationSessionId) {
    const session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
    return { client_secret: session.client_secret };
  }

  try {
    const { client_secret } = await createVerificationSession(user.id, user.email);
    return { client_secret };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return data({ message: "Error creating verification session" }, { status: 500 });
  }
}

async function createVerificationSession(user_id: User["id"], email: string) {
  const verificationSession = await stripe.identity.verificationSessions.create({
    type: "document",
    provided_details: { email },
    metadata: { user_id },
  });
  await UserService.update(user_id, { stripeVerificationSessionId: verificationSession.id });
  return verificationSession;
}
