/* eslint-disable no-undef */
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import * as Sentry from "@sentry/react-router";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.VERCEL_ENV,

  sampleRate: 1.0,

  tracesSampleRate: 0.5,
  profileSessionSampleRate: 0.5,
  profileLifecycle: "trace",

  sendDefaultPii: true,
  integrations: [nodeProfilingIntegration(), Sentry.prismaIntegration()],
});
