import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import { StrictMode, startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

import { Sentry } from "~/integrations/sentry";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  tracesSampleRate: 0.25,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1,
  enabled: window.location.hostname !== "localhost",
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  environment: window?.ENV?.VERCEL_ENV,
  integrations: [
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
      enableInp: true,
    }),
    Sentry.replayIntegration(),
  ],
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});
