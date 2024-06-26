import { PrismaInstrumentation } from "@prisma/instrumentation";
import type { TriggerConfig } from "@trigger.dev/sdk/v3";

import { Sentry } from "~/integrations/sentry";

export const config: TriggerConfig = {
  project: "proj_wkknrufxoeexxegqdcsz",
  logLevel: "log",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  triggerDirectories: ["./app/jobs"],
  dependenciesToBundle: ["nanoid"],
  instrumentations: [new PrismaInstrumentation()],
  additionalFiles: ["./prisma/schema.prisma"],
  additionalPackages: ["prisma@5.16.0"],
  // eslint-disable-next-line @typescript-eslint/require-await
  onFailure: async (_, error) => {
    Sentry.captureException(error);
  },
};
