import type { Config } from "@react-router/dev/config";
import { sentryOnBuildEnd } from "@sentry/react-router";
import { vercelPreset } from "@vercel/react-router/vite";

const isVercel = process.env.VERCEL === "1";

export default {
  future: {
    unstable_middleware: true,
  },
  ssr: true,
  ...(isVercel && { presets: [vercelPreset()] }),
  buildEnd: async ({ viteConfig, reactRouterConfig, buildManifest }) => {
    if (process.env.CI) {
      await sentryOnBuildEnd({ viteConfig, reactRouterConfig, buildManifest });
    }
  },
} satisfies Config;
