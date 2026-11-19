import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  dirs: ["./jobs"],
  maxDuration: 300,
  project: "proj_wkknrufxoeexxegqdcsz",
  runtime: "node-24",
  build: {
    extensions: [
      prismaExtension({
        mode: "modern",
      }),
    ],
    external: ["@napi-rs/canvas", "fsevents", "resend", "@react-email/render", "@react-email/components"],
  },
});
