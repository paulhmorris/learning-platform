import { ActionFunctionArgs } from "react-router";

import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Toasts } from "~/lib/toast.server";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Api.Users.LinkToClerk");

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireSuperAdmin(args);

  if (args.request.method !== "POST") {
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "Invalid request method",
    });
  }

  const data = Object.fromEntries(await args.request.formData());
  const clerkId = data.clerkId;

  if (!clerkId || typeof clerkId !== "string") {
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "Missing clerkId",
    });
  }

  const user = await db.user.findUnique({ where: { clerkId } });

  if (!user) {
    logger.error(`User not found in database with Clerk ID ${clerkId}`);
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "User not found in database",
    });
  }

  // Link the user to Clerk
  await AuthService.saveExternalId(clerkId, user.id);

  logger.info(`User ${user.id} linked to Clerk ID ${clerkId}`);
  return Toasts.dataWithSuccess(null, {
    message: "Success",
    description: "User has been linked to Clerk",
  });
}
