import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3000";

function getBaseUrl() {
  return process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;
}

/**
 * Polls the healthcheck endpoint until it returns 200, waking up cold services.
 * Also warms the root page (/) to prime the CMS + Clerk SSR pipeline, since
 * the healthcheck route self-fetches to / internally.
 */
async function waitForHealthyServer(baseUrl: string, { timeoutMs = 90_000, intervalMs = 3_000 } = {}) {
  const healthcheckUrl = new URL("/healthcheck", baseUrl).toString();
  const rootUrl = new URL("/", baseUrl).toString();
  const deadline = Date.now() + timeoutMs;

  // eslint-disable-next-line no-console
  console.log(`⏳ Warming up server at ${healthcheckUrl}...`);

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthcheckUrl);
      if (response.ok) {
        // eslint-disable-next-line no-console
        console.log(`✅ Server is healthy (${response.status})`);
        // Also warm the root page to prime CMS + SSR pipeline
        await fetch(rootUrl).catch(() => undefined);
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`  Server responded with ${response.status}, retrying...`);
    } catch {
      // eslint-disable-next-line no-console
      console.log(`  Server not reachable yet, retrying...`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Server at ${healthcheckUrl} did not become healthy within ${timeoutMs / 1000}s`);
}

// Setup must be run serially, this is necessary if Playwright is configured to run fully parallel: https://playwright.dev/docs/test-parallel
setup.describe.configure({ mode: "serial" });

setup("global setup", async () => {
  setup.setTimeout(120_000);
  await waitForHealthyServer(getBaseUrl());
  await clerkSetup();
});
