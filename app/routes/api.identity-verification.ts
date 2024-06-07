import { Prisma, User } from "@prisma/client";
import { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@vercel/remix";

import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { getPrismaErrorText } from "~/lib/responses.server";
import { SessionService } from "~/services/SessionService.server";

const secret = process.env.STRIPE_WEBHOOK_SECRET;

export async function action({ request }: ActionFunctionArgs) {
  const user_id = await SessionService.requireUserId(request);

  switch (request.method.toUpperCase()) {
    case "POST": {
      // Is a Stripe webhook event
      const sig = request.headers.get("stripe-signature");
      if (sig) {
        let event: ReturnType<typeof stripe.webhooks.constructEvent>;

        try {
          event = stripe.webhooks.constructEvent(JSON.stringify(request.body), sig, secret);
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
          return new Response("Webook Error", { status: 400 });
        }

        try {
          switch (event.type) {
            case "identity.verification_session.requires_input": {
              // TODO: Send email to user to retry verification
              await db.user.update({
                where: { id: user_id },
                data: { isIdentityVerified: false, stripeVerificationSessionId: null },
              });
              return new Response("Webhook Success", { status: 200 });
            }
            case "identity.verification_session.verified": {
              // TODO: Send email to user that verification was successful
              await db.user.update({
                where: { id: user_id },
                data: { isIdentityVerified: true, stripeVerificationSessionId: null },
              });
              return new Response("Webhook Success", { status: 200 });
            }
            default: {
              console.error(`Unhandled event type: ${event.type}`);
              return new Response("Webhook Error", { status: 400 });
            }
          }
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
          return new Response("Webook Error", { status: 500 });
        }
      }

      try {
        const result = await createVerificationSession(user_id);
        return json({ client_secret: result.client_secret });
      } catch (error) {
        console.error(error);
        Sentry.captureException(error);
        let message =
          error instanceof Error ? error.message : "An error occurred while creating a verification session.";
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          message = getPrismaErrorText(error);
        }
        return json({ message }, { status: 500 });
      }
    }

    default: {
      return new Response(null, { status: 405 });
    }
  }
}

async function createVerificationSession(user_id: User["id"]) {
  const verificationSession = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { user_id },
  });
  await db.user.update({
    where: { id: user_id },
    data: { stripeVerificationSessionId: verificationSession.id },
  });
  return verificationSession;
}
