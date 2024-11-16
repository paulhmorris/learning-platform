import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  tracesSampleRate: 0.1,
  autoInstrumentRemix: true,
  // eslint-disable-next-line no-undef
  enabled: process.env.NODE_ENV === "production",
  integrations: [Sentry.prismaIntegration()],
});
