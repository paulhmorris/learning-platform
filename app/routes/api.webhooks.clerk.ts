import { verifyWebhook } from "@clerk/backend/webhooks";
import { ActionFunctionArgs } from "react-router";

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
    } catch (error) {
      Sentry.captureException(error, { extra: { eventType, userId: event.data.id } });
      logger.error(`Error creating user in stripe from Clerk webhook event ${eventType}`, { error });
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
