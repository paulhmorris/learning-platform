import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { clerk } from "@clerk/testing/playwright";
import type { Browser, Page } from "@playwright/test";

import { createLogger } from "~/integrations/logger.server";
import { stripe } from "~/integrations/stripe.server";
import { AuthService } from "~/services/auth.server";
import { PaymentService } from "~/services/payment.server";

const DEFAULT_BASE_URL = "http://localhost:3000";
const logger = createLogger("E2E.AuthHelpers");

type Credentials = {
  email: string;
  password: string;
};

export type TestUser = Credentials & {
  id: string;
  stripeCustomerId?: string;
};

function getBaseUrl() {
  return process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function loginAsRegularUser(page: Page, credentials: Credentials) {
  const { email, password } = credentials;
  const signInUrl = new URL("/sign-in", getBaseUrl()).toString();

  logger.info(`Logging in test user ${email}`);
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

export async function ensureAuthenticatedStorageState(
  browser: Browser,
  credentials: Credentials,
  workerIndex = 0,
  storageKey?: string,
) {
  const safeKey = storageKey ? storageKey.replace(/[^a-zA-Z0-9_-]/g, "_") : undefined;
  const storageStatePath = path.join(
    process.cwd(),
    "test",
    "e2e",
    ".auth",
    `regular-user-worker-${workerIndex}${safeKey ? `-${safeKey}` : ""}.json`,
  );

  logger.debug(`Ensuring authenticated storage state for worker ${workerIndex} at ${storageStatePath}`);
  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const refreshStorageState = async () => {
    logger.info(`Refreshing authenticated storage state for worker ${workerIndex} at ${storageStatePath}`);
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
    logger.warn(`Storage state invalid; reauth required for worker ${workerIndex}`);
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

  logger.info(`Creating E2E test user ${email}`);
  const user = await AuthService.createUser({
    firstName: "E2E",
    lastName: "Test User" + workerIndex,
    emailAddress: [email],
    password,
  });

  const stripeCustomer = await PaymentService.upsertCustomer(user.id, {
    metadata: {
      source: "e2e",
    },
  });

  return { id: user.id, email, password, stripeCustomerId: stripeCustomer.id };
}

export async function deleteE2ETestUser(userId: string, stripeCustomerId?: string) {
  if (stripeCustomerId) {
    try {
      await stripe.customers.del(stripeCustomerId);
    } catch {
      // Ignore Stripe cleanup failures in tests.
    }
  }
  await AuthService.deleteUser(userId);
}
