/* eslint-disable no-undef */
import * as Sentry from "@sentry/react-router";

// const isProd = process.env.VERCEL_ENV === "production";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV,

  sampleRate: 1.0,
  tracesSampleRate: 1.0,

  sendDefaultPii: true,
  integrations: [Sentry.prismaIntegration()],

  // Stale, content-hashed asset requests (e.g. /assets/index-XLjWcFRZ.js.map)
  // hit the server after a deploy when a client is still running old code. React
  // Router turns them into an internal 404 ("No route matches URL") that Sentry's
  // request instrumentation captures on its own path — before React Router's
  // `handleError` hook (see app/entry.server.ts) can suppress them. Drop them here
  // so they never reach Sentry regardless of capture path.
  beforeSend(event, hint) {
    const message =
      (hint?.originalException instanceof Error && hint.originalException.message) ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      event.exception?.values?.[0]?.value ||
      "";
    if (/No route matches URL "\/assets\/.*"/.test(message)) {
      return null;
    }
    return event;
  },
});
