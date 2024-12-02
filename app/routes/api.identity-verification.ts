import { Prisma, User } from "@prisma/client";
import { ActionFunctionArgs, json } from "@vercel/remix";

import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { getPrismaErrorText } from "~/lib/responses.server";
import { SessionService } from "~/services/session.server";
import { UserService } from "~/services/user.server";

// POST or PUT /api/identity-verification
export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  if (user.isIdentityVerified) {
    return new Response("User is already verified or has an active session", { status: 400 });
  }

  if (user.stripeVerificationSessionId) {
    const session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
    return json({ client_secret: session.client_secret });
  }

  try {
    const { client_secret } = await createVerificationSession(user.id, user.email);
    return json({ client_secret });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    let message = error instanceof Error ? error.message : "An error occurred while creating a verification session.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      message = getPrismaErrorText(error);
    }
    return json({ message }, { status: 500 });
  }
}

async function createVerificationSession(user_id: User["id"], email: User["email"]) {
  const verificationSession = await stripe.identity.verificationSessions.create({
    type: "document",
    provided_details: { email },
    metadata: { user_id },
  });
  await UserService.update(user_id, { stripeVerificationSessionId: verificationSession.id });
  return verificationSession;
}
