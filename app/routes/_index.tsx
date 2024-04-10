import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "remix-typedjson";

import { SessionService } from "~/services/SessionService.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.getUser(request);
  if (user) {
    return redirect("/account");
  }

  return redirect("/login");
}
