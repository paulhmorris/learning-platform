import { verifyWebhook } from "@clerk/backend/webhooks";
import { ActionFunctionArgs } from "react-router";

import { Responses } from "~/lib/responses.server";
import { UserService } from "~/services/user.server";

// Webhook for Clerk
export async function action(args: ActionFunctionArgs) {
  const event = await verifyWebhook(args.request);
  const eventType = event.type;

  if (eventType === "user.created") {
    try {
      await UserService.create(event.data.id);
    } catch (error) {
      console.error("Error creating user:", error);
    }
  }

  return Responses.ok();
}
