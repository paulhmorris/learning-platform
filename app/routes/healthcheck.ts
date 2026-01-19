/* eslint-disable no-console */
import type { LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const host = request.headers.get("X-Forwarded-Host") ?? request.headers.get("host");

  try {
    const url = new URL("/", `http://${host}`);
    // if we can connect to the database and make a simple query
    // and make a HEAD request to ourselves, then we're good.
    await Promise.all([
      db.course.count(),
      fetch(url.toString(), { method: "HEAD" }).then((r) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        if (!r.ok) return Promise.reject(r);
      }),
    ]);
    return new Response("OK");
  } catch (error: unknown) {
    console.log("healthcheck ❌", { error });
    return new Response("ERROR", { status: 500 });
  }
};
