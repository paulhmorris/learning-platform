/* eslint-disable no-console */

import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";

export const loader = async () => {
  try {
    // Railway's healthcheck sends `Host: healthcheck.railway.app`, so call ourselves directly.
    const url = new URL("/", `http://localhost:${process.env.PORT ?? 3000}`);
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
    Sentry.captureException(error);
    return new Response("ERROR", { status: 500 });
  }
};
