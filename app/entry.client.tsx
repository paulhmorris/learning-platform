import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

import { Sentry } from "~/integrations/sentry";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  enabled: window.location.hostname !== "localhost",
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  environment: window.ENV?.VERCEL_ENV,

  sampleRate: 1.0,
  tracesSampleRate: 0.25,
  profilesSampleRate: 0.25,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1,
  sendDefaultPii: true,

  integrations: [
    Sentry.reactRouterTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, maskAllInputs: false }),
  ],
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
