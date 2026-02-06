import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { clerk } from "@clerk/testing/playwright";
import type { Browser, Page } from "@playwright/test";

import { createLogger } from "~/integrations/logger.server";
import { AuthService } from "~/services/auth.server";

const DEFAULT_BASE_URL = "http://localhost:3000";
const logger = createLogger("E2E.AuthHelpers");

type Credentials = {
  email: string;
  password: string;
};

export type TestUser = Credentials & {
  id: string;
};

function getBaseUrl() {
  return process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function loginAsRegularUser(page: Page, credentials: Credentials) {
  const { email, password } = credentials;
  const signInUrl = new URL("/sign-in", getBaseUrl()).toString();

  logger.info("Logging in test user", { email });
  await page.goto(signInUrl, { waitUntil: "domcontentloaded" });

  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: email,
      password,
    },
  });

  await page.goto(new URL("/preview", getBaseUrl()).toString());
}

export async function ensureAuthenticatedStorageState(browser: Browser, credentials: Credentials, workerIndex = 0) {
  const storageStatePath = path.join(process.cwd(), "test", "e2e", ".auth", `regular-user-worker-${workerIndex}.json`);

  logger.debug("Ensuring authenticated storage state", { workerIndex, storageStatePath });
  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const refreshStorageState = async () => {
    logger.info("Refreshing authenticated storage state", { workerIndex, storageStatePath });
    const page = await browser.newPage();
    await loginAsRegularUser(page, credentials);
    await page.context().storageState({ path: storageStatePath });
    await page.close();
    return storageStatePath;
  };

  try {
    await fs.access(storageStatePath);
  } catch {
    return refreshStorageState();
  }

  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  const previewUrl = new URL("/preview", getBaseUrl()).toString();
  await page.goto(previewUrl, { waitUntil: "domcontentloaded" });

  if (page.url().includes("/sign-in")) {
    logger.warn("Storage state invalid; reauth required", { workerIndex, storageStatePath });
    await page.close();
    await context.close();
    return refreshStorageState();
  }

  await page.close();
  await context.close();
  return storageStatePath;
}

export async function createE2ETestUser(workerIndex: number): Promise<TestUser> {
  const uniqueId = randomUUID();
  const email = `e2e-${workerIndex}-${uniqueId}+clerk_test@example.com`;
  const password = `TestPassword!${uniqueId}`;

  logger.info("Creating E2E test user", { workerIndex, email });
  const user = await AuthService.createUser({
    firstName: "E2E",
    lastName: "Test User" + workerIndex,
    emailAddress: [email],
    password,
  });

  console.log(`Created test user with email: ${email} and password: ${password}`);

  return { id: user.id, email, password };
}

export async function deleteE2ETestUser(userId: string) {
  logger.info("Deleting E2E test user", { userId });
  await AuthService.deleteUser(userId);
}
