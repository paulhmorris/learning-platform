import { verifyWebhook } from "@clerk/backend/webhooks";
import { ActionFunctionArgs } from "react-router";

import { SERVER_CONFIG } from "~/config.server";
import WelcomeEmail from "~/emails/welcome";
import { EmailService } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("Api.Webhooks.Clerk");

// Webhook for Clerk
export async function action(args: ActionFunctionArgs) {
  let event;
  try {
    event = await verifyWebhook(args.request);
  } catch (error) {
    Sentry.captureException(error, { extra: { info: "Error verifying Clerk webhook" } });
    logger.error("Error verifying Clerk webhook", { error });
    return Responses.badRequest("Invalid webhook");
  }

  const eventType = event.type;

  logger.info(`Received Clerk webhook event: ${eventType}`);

  if (eventType === "user.created") {
    try {
      await UserService.linkToStripe(event.data.id);

      const email = event.data.email_addresses.at(0)?.email_address;
      const firstName = event.data.first_name;
      if (email) {
        await EmailService.send({
          to: email,
          from: `Plumb Media & Education <no-reply@${SERVER_CONFIG.emailFromDomain}>`,
          subject: "Welcome to Plumb Media & Education!",
          react: WelcomeEmail({ firstName: firstName ?? "new user" }),
        });
      }
    } catch (error) {
      Sentry.captureException(error, { extra: { eventType, userId: event.data.id } });
      logger.error(`Error creating user in stripe from Clerk webhook event ${eventType}`, { error });

      // Check if this is a retriable error or if the user was already processed
      // If the user already has a Stripe customer, consider it successful
      try {
        const user = await UserService.getById(event.data.id);
        if (user?.publicMetadata.stripeCustomerId) {
          logger.info(`User ${event.data.id} already has Stripe customer, considering webhook successful`);
          return Responses.ok();
        }
      } catch (lookupError) {
        // If we can't check the user, log but continue with the error response
        logger.warn(`Failed to check if user ${event.data.id} has Stripe customer`, { error: lookupError });
      }

      return Responses.serverError();
    }
  }

  if (eventType === "user.deleted") {
    if (!event.data.id) {
      logger.error(`User deletion event received without user ID`);
      return Responses.badRequest("User ID is required for deletion");
    }
    try {
      await UserService.delete(event.data.id);
    } catch (error) {
      Sentry.captureException(error, { extra: { eventType, userId: event.data.id } });
      logger.error(`Error deleting user ${event.data.id} from Clerk webhook event ${eventType}`, { error });
      return Responses.serverError();
    }
  }

  return Responses.ok();
}

export const loader = () => Responses.methodNotAllowed();
