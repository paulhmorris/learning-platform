import { ActionFunctionArgs } from "react-router";

import { SERVER_CONFIG } from "~/config.server";
import { EmailService } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { Responses } from "~/lib/responses.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("Api.Webhooks.Stripe");

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
          logger.error("Error constructing Stripe webhook event", { error });
          Sentry.captureException(error);
          return Responses.badRequest("Error constructing event");
        }

        logger.info("Received Stripe webhook event", { event });
        try {
          switch (event.type) {
            // The user must provide additional information to verify their identity
            case "identity.verification_session.requires_input": {
              const userId = event.data.object.metadata.user_id;
              const errorReason = event.data.object.last_error?.reason;
              logger.info("Verification check failed", { userId, errorReason });

              if (!userId) {
                Sentry.captureMessage(
                  "Received Stripe identity.verification_session.requires_input event without user ID",
                  { level: "error" },
                );
                logger.error("User ID not found in metadata");
                return Responses.badRequest("User ID is required for verification input");
              }

              const user = await UserService.getById(userId);

              if (!user) {
                Sentry.captureMessage(
                  "Received Stripe identity.verification_session.requires_input event for unknown user: " + userId,
                  { level: "error" },
                );
                logger.error("User not found", { userId });
                return Responses.badRequest("User not found");
              }

              await Promise.allSettled([
                EmailService.send({
                  to: `events@${SERVER_CONFIG.emailFromDomain}`,
                  from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
                  subject: "Identity Verification Requires Input",
                  html: `<p>Identity verification requires input for user ${user.email}.</p>`,
                }),
                EmailService.send({
                  to: user.email,
                  from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
                  subject: "Action Required: Verify Your Identity",
                  html: `<p>More information is required to verify your identity. Please log in to your account to view next steps.</p>`,
                }),
              ]);

              return Responses.ok();
            }

            case "identity.verification_session.verified": {
              const userId = event.data.object.metadata.user_id;
              if (!userId) {
                Sentry.captureMessage("Received Stripe identity.verification_session.verified event without user ID", {
                  level: "error",
                });
                logger.error("User ID not found in metadata", { userId, metadata: event.data.object.metadata });
                return Responses.badRequest("User ID is required for verification input");
              }

              const user = await UserService.getById(userId);
              if (!user) {
                Sentry.captureMessage(
                  "Received Stripe identity.verification_session.verified event for unknown user: " + userId,
                  { level: "error" },
                );
                logger.error("User not found", { userId });
                return Responses.badRequest("User not found");
              }

              logger.info("Verification successful for user", { userId });
              await EmailService.send({
                to: user.email,
                from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
                subject: "Identity Verification Successful!",
                html: "<p>Your identity has been successfully verified. You can now claim a certificate from courses that require identity verification.</p>",
              });

              await UserService.update(userId, { isIdentityVerified: true });
              return Responses.ok("Webhook Success");
            }

            default: {
              logger.info("Unhandled event type", { event });
              return Responses.ok("Unhandled event type");
            }
          }
        } catch (error) {
          logger.error("Error processing Stripe webhook event", { error });
          Sentry.captureException(error);
          return new Response("Webook Error", { status: 500 });
        }
      }
      break;
    }

    default: {
      return Responses.methodNotAllowed();
    }
  }
}
