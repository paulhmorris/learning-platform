import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { handleRequest } from "@vercel/remix";

import { Sentry } from "~/integrations/sentry";
import { validateEnv } from "~/lib/env.server";

validateEnv();
const ABORT_DELAY = 5_000;

export const handleError = Sentry.sentryHandleError;

Sentry.init({
  sampleRate: 1,
  tracesSampleRate: 0.25,
  dsn: "https://f18051d71458f411f51af7ca0308b1cb@o4505496663359488.ingest.sentry.io/4506395673886720",
  environment: process.env.VERCEL_ENV,
  enabled: process.env.NODE_ENV === "production",
  integrations: [nodeProfilingIntegration(), Sentry.prismaIntegration()],
});

export default function (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const remixServer = <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />;
  return handleRequest(request, responseStatusCode, responseHeaders, remixServer);
}
