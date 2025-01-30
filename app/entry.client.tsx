import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import { StrictMode, startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

import { AnalyticsInit } from "~/components/analytics-init";
import { Sentry } from "~/integrations/sentry";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  tracesSampleRate: window.ENV.VERCEL_ENV === "preview" ? 0.5 : 0.1,
  replaysSessionSampleRate: window.ENV.VERCEL_ENV === "production" ? 0.01 : 0,
  replaysOnErrorSampleRate: 1,
  enabled: process.env.NODE_ENV === "production",
  integrations: [
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
      enableInp: true,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
      <AnalyticsInit />
    </StrictMode>,
  );
});
