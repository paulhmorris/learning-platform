// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import { sentryReactRouter, type SentryReactRouterBuildOptions } from "@sentry/react-router";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { coverageConfigDefaults, defaultExclude } from "vitest/config";

const sentryConfig: SentryReactRouterBuildOptions = {
  telemetry: false,
  org: "cosmic-labs",
  project: "learning-platform",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourceMapsUploadOptions: {
    filesToDeleteAfterUpload: ["**/*.map"],
  },
};

const isCI = !!process.env.CI;

export default defineConfig((config) => ({
  resolve: {
    conditions: ["module-sync"],
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
    },
  },
  build: {
    target: "esnext",
    sourcemap: !!process.env.CI,
    rollupOptions: config.isSsrBuild
      ? {
          input: "./app/server/index.ts",
        }
      : undefined,
  },
  server: {
    port: 3000,
  },
  plugins: [
    reactRouterHonoServer(),
    tsconfigPaths(),
    !process.env.VITEST && reactRouter(),
    ...(isCI ? [sentryReactRouter(sentryConfig, config)] : []),
  ],
  optimizeDeps: {
    exclude: ["@napi-rs/canvas"],
  },
  test: {
    exclude: [...defaultExclude, "**/*.config.*", "**/playwright/**", "test/e2e/**"],
    globals: true,
    pool: "threads",
    environment: "jsdom",
    setupFiles: "./test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["app/"],
      exclude: [...coverageConfigDefaults.exclude, "app/components/ui/**"],
    },
  },
}));
