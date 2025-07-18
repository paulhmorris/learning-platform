import { verifyWebhook } from "@clerk/backend/webhooks";
import { ActionFunctionArgs } from "react-router";

import { createLogger } from "~/integrations/logger.server";
import { Responses } from "~/lib/responses.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("Api.Webhooks.Clerk");

// Webhook for Clerk
export async function action(args: ActionFunctionArgs) {
  const event = await verifyWebhook(args.request);
  const eventType = event.type;

  logger.info({ event }, "Received Clerk webhook event");

  if (eventType === "user.created") {
    try {
      await UserService.create(event.data.id);
    } catch (error) {
      logger.error({ event, error }, "Error creating user");
    }
  }

  if (eventType === "user.deleted") {
    if (!event.data.id) {
      logger.error({ event }, "User deletion event received without user ID");
      return Responses.badRequest("User ID is required for deletion");
    }
    try {
      await UserService.delete(event.data.id);
    } catch (error) {
      logger.error({ event, error }, "Error deleting user");
    }
  }

  return Responses.ok();
}
