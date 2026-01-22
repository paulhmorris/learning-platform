import { promises as fs } from "node:fs";
import path from "node:path";

import type { Browser, Page } from "@playwright/test";

const DEFAULT_BASE_URL = "http://localhost:3000";
const STORAGE_STATE_PATH = path.join(process.cwd(), "test", "e2e", ".auth", "regular-user.json");

type Credentials = {
  email: string;
  password: string;
};

function getE2ECredentials(): Credentials {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing E2E_USER_EMAIL or E2E_USER_PASSWORD env vars for authenticated tests.");
  }

  return { email, password };
}

function getBaseUrl() {
  return process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function loginAsRegularUser(page: Page) {
  const { email, password } = getE2ECredentials();
  const signInUrl = new URL("/sign-in", getBaseUrl()).toString();

  await page.goto(signInUrl, { waitUntil: "domcontentloaded" });

  const emailInput = page.getByLabel(/email/i);
  if (await emailInput.isVisible()) {
    await emailInput.fill(email);
  } else {
    await page.getByPlaceholder(/email/i).fill(email);
  }

  const continueButton = page.getByRole("button", { name: /continue/i });
  if (await continueButton.isVisible()) {
    await continueButton.click();
  }

  const passwordInput = page.getByLabel("Password", { exact: true });
  await passwordInput.fill(password);

  const signInButton = page.getByRole("button", { name: /continue/i });
  await signInButton.click();

  await page.waitForURL(/^(?!.*\/sign-in).*$/);
}

export async function ensureAuthenticatedStorageState(browser: Browser) {
  try {
    await fs.access(STORAGE_STATE_PATH);
    return STORAGE_STATE_PATH;
  } catch {
    // continue
  }

  await fs.mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const page = await browser.newPage();
  await loginAsRegularUser(page);
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await page.close();

  return STORAGE_STATE_PATH;
}
