import { tasks } from "@trigger.dev/sdk";

import { Sentry } from "~/integrations/sentry";

Sentry.init({
  enabled: process.env.NODE_ENV === "production",
  dsn: "https://3093e529a633d80d697b26390e53886d@o4505496663359488.ingest.us.sentry.io/4506584484151296",
  environment: process.env.VERCEL_ENV,
  // Trigger.dev runs its own OpenTelemetry; Sentry's default integrations conflict with it.
  defaultIntegrations: false,
  attachStacktrace: false,
  initialScope: { tags: { runtime: "trigger" } },
});

tasks.onFailure(({ payload, error, ctx }) => {
  Sentry.captureException(error, { extra: { payload, runId: ctx.run.id, taskId: ctx.task.id } });
});
