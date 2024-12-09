/* eslint-disable no-undef */
import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  tracesSampleRate: process.env.VERCEL_ENV === "preview" ? 1 : 0.2,
  autoInstrumentRemix: true,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV,
  integrations: [Sentry.prismaIntegration()],
});
