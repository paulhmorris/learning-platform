import path from "path";
import { loadEnvFile } from "process";
import { fileURLToPath } from "url";

import { defineConfig, devices } from "@playwright/test";

// Load environment variables from .env file if it exists
loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

const e2eBaseUrl = process.env.E2E_BASE_URL;
const isLocalBaseUrl = !e2eBaseUrl || e2eBaseUrl.includes("localhost") || e2eBaseUrl.includes("127.0.0.1");

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: e2eBaseUrl ?? "http://localhost:3000",

    testIdAttribute: "data-testid",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: process.env.CI ? "only-on-failure" : "off",
    video: process.env.CI ? "retain-on-failure" : "off",

    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "setup",
      testMatch: "**/*.setup.ts",
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: "Mobile Chrome",
    //   use: { ...devices["Pixel 5"] },
    // },
    // {
    //   name: "Mobile Safari",
    //   use: { ...devices["iPhone 12"] },
    // },
  ],

  webServer: isLocalBaseUrl
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
