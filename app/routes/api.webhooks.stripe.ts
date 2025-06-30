import { ActionFunctionArgs } from "react-router";

import { EMAIL_FROM_DOMAIN } from "~/config.server";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { UserService } from "~/services/user.server";

const secret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/webhooks/stripe
export async function action({ request }: ActionFunctionArgs) {
  switch (request.method.toUpperCase()) {
    case "POST": {
      // Is a Stripe webhook event
      const sig = request.headers.get("stripe-signature");
      if (sig && request.body) {
        let event: ReturnType<typeof stripe.webhooks.constructEvent>;

        try {
          event = stripe.webhooks.constructEvent(await request.text(), sig, secret);
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
          return new Response("Webook Error", { status: 400 });
        }

        try {
          switch (event.type) {
            // The user must provide additional information to verify their identity
            case "identity.verification_session.requires_input": {
              const userId = event.data.object.metadata.user_id;
              const errorReason = event.data.object.last_error?.reason;
              console.info("Verification check failed: " + errorReason);

              if (!userId) {
                Sentry.captureMessage(
                  "Received Stripe identity.verification_session.requires_input event without user ID",
                  { level: "error" },
                );
                console.error("User ID not found in metadata");
                return new Response("Webhook Error", { status: 400 });
              }

              const user = await UserService.getById(userId);

              if (!user) {
                Sentry.captureMessage(
                  "Received Stripe identity.verification_session.requires_input event for unknown user: " + userId,
                  { level: "error" },
                );
                console.error("User not found");
                return new Response("Webhook Error", { status: 400 });
              }

              await Promise.allSettled([
                EmailService.send({
                  to: `events@${EMAIL_FROM_DOMAIN}`,
                  from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
                  subject: "Identity Verification Requires Input",
                  html: `<p>Identity verification requires input for user ${user.email}.</p>`,
                }),
                EmailService.send({
                  to: user.email,
                  from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
                  subject: "Action Required: Verify Your Identity",
                  html: `<p>More information is required to verify your identity. Please log in to your account to view next steps.</p>`,
                }),
              ]);

              return new Response(null, { status: 200 });
            }

            case "identity.verification_session.verified": {
              const userId = event.data.object.metadata.user_id;
              if (!userId) {
                Sentry.captureMessage("Received Stripe identity.verification_session.verified event without user ID", {
                  level: "error",
                });
                console.error("User ID not found in metadata");
                return new Response("Webhook Error", { status: 400 });
              }

              const user = await UserService.getById(userId);
              if (!user) {
                Sentry.captureMessage(
                  "Received Stripe identity.verification_session.verified event for unknown user: " + userId,
                  { level: "error" },
                );
                console.error("User not found");
                return new Response("Webhook Error", { status: 400 });
              }

              console.info("Verification successful for user " + userId);
              await EmailService.send({
                to: user.email,
                from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
                subject: "Identity Verification Successful!",
                html: "<p>Your identity has been successfully verified. You can now claim a certificate from courses that require identity verification.</p>",
              });

              await UserService.update(userId, { isIdentityVerified: true });
              return new Response("Webhook Success", { status: 200 });
            }

            default: {
              console.info(`Unhandled event type: ${event.type}`);
              return new Response(null, { status: 200 });
            }
          }
        } catch (error) {
          console.error(error);
          Sentry.captureException(error);
          return new Response("Webook Error", { status: 500 });
        }
      }
      break;
    }

    default: {
      return new Response(null, { status: 405 });
    }
  }
}
