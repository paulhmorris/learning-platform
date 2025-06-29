import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { redis } from "~/integrations/redis.server";
import { SessionService } from "~/services/session.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  await redis.del(`user-${userId}`);
  return await SessionService.logout(request);
};

export const loader = () => redirect("/");
