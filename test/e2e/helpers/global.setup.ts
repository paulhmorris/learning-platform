import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

import { createLogger } from "~/integrations/logger.server";

const logger = createLogger("E2E.GlobalSetup");

// Setup must be run serially, this is necessary if Playwright is configured to run fully parallel: https://playwright.dev/docs/test-parallel
setup.describe.configure({ mode: "serial" });

setup("global setup", async ({}) => {
  logger.info("Starting global setup");
  await clerkSetup();
  logger.info("Completed global setup");
});
