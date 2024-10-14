import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { vercelPreset } from "@vercel/remix/vite";
import morgan from "morgan";
import { ViteDevServer, defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isVercel = process.env.VERCEL === "1";
const isCI = !!process.env.CI;

installGlobals();

export default defineConfig({
  build: {
    sourcemap: !!process.env.CI,
  },
  server: {
    port: 3000,
  },
  plugins: [
    morganPlugin(),
    tsconfigPaths(),
    remix({
      ...(isVercel && { presets: [vercelPreset()] }),
      ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
      serverModuleFormat: "esm",
    }),
    isCI &&
      sentryVitePlugin({
        telemetry: false,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          filesToDeleteAfterUpload: ["*.map"],
        },
      }),
  ],
  optimizeDeps: {
    exclude: ["@napi-rs/canvas"],
  },
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
    },
  },
});

function morganPlugin() {
  return {
    name: "morgan-plugin",
    configureServer(server: ViteDevServer) {
      return () => {
        server.middlewares.use(morgan("tiny"));
      };
    },
  };
}
