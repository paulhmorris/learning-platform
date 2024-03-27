import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
    },
  },
  plugins: [
    tsconfigPaths(),
    remix({
      ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
      serverModuleFormat: "esm",
    }),
  ],
});
