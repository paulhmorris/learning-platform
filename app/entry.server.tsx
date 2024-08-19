import { RemixServer } from "@remix-run/react";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { handleRequest, type EntryContext } from "@vercel/remix";
import { DataFunctionArgs } from "node_modules/@sentry/remix/build/types/utils/vendor/types";

import { Sentry } from "~/integrations/sentry";

// validateEnv();
const ABORT_DELAY = 5_000;

export const handleError = (err: unknown, ctx: DataFunctionArgs) => {
  console.error(err);
  return Sentry.sentryHandleError(err, ctx);
};

Sentry.init({
  sampleRate: 1,
  tracesSampleRate: 0.25,
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  enabled: process.env.NODE_ENV === "production",
  integrations: [nodeProfilingIntegration(), Sentry.prismaIntegration()],
});

export default async function (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  const remixServer = <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />;
  return handleRequest(request, responseStatusCode, responseHeaders, remixServer);
}
