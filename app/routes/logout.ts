import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { redis } from "~/integrations/redis.server";
import { SessionService } from "~/services/SessionService.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  await redis.del(`user-${userId}`);
  return await SessionService.logout(request);
};

export const loader = () => redirect("/");
