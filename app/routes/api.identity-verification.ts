import { Prisma, User } from "@prisma/client";
import { ActionFunctionArgs, json } from "@remix-run/node";

import { db } from "~/integrations/db.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { getPrismaErrorText } from "~/lib/responses.server";
import { SessionService } from "~/services/SessionService.server";

const secret = process.env.STRIPE_WEBHOOK_SECRET;

export async function action({ request }: ActionFunctionArgs) {
  const user_id = await SessionService.getUserId(request);

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
            // The user must provide additional information to verify their identity
            case "identity.verification_session.requires_input": {
              console.info("Verification check failed: " + event.data.object.last_error?.reason);

              if (!event.data.object.metadata.user_id) {
                console.error("User ID not found in metadata");
                return new Response("Webhook Error", { status: 400 });
              }

              const user = await db.user.findUniqueOrThrow({ where: { id: event.data.object.metadata.user_id } });

              await EmailService.send({
                to: user.email,
                from: "Plumb Media & Education <no-reply@getcosmic.dev>",
                subject: "Action Required: Verify Your Identity",
                html: `<p>More information is required to verify your identity. ${event.data.object.last_error?.reason}</p>`,
              });

              break;
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

      // Create a new verification session
      try {
        if (!user_id) {
          throw new Error("User ID not found in session");
        }
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
