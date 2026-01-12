import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk/v3";

import { Sentry } from "./app/integrations/sentry";

export default defineConfig({
  dirs: ["./jobs"],
  maxDuration: 300,
  project: "proj_wkknrufxoeexxegqdcsz",
  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
      }),
    ],
    external: ["@napi-rs/canvas", "fsevents", "resend"],
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onFailure: async ({ error }) => {
    Sentry.captureException(error);
  },
});
