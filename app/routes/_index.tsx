import { redirect, type LoaderFunctionArgs } from "react-router";

import { SessionService } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.getUser(request);
  if (user) {
    return redirect("/account");
  }

  return redirect("/login");
}
