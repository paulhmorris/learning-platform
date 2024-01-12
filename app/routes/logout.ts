import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

// import { Sentry } from "~/integrations/sentry";
import { SessionService } from "~/services/SessionService.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Sentry.setUser(null);
  return await SessionService.logout(request);
};

export const loader = () => redirect("/");
