import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import { StrictMode, startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

import { Sentry } from "~/integrations/sentry";

Sentry.init({
  dsn: "https://f18051d71458f411f51af7ca0308b1cb@o4505496663359488.ingest.sentry.io/4506395673886720",
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
