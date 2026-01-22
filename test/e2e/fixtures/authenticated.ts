import { test as base, expect } from "@playwright/test";

import { ensureAuthenticatedStorageState } from "../helpers/auth";

type AuthFixtures = {
  storageState: string;
};

export const test = base.extend<AuthFixtures>({
  storageState: async ({ browser }, use) => {
    const storageState = await ensureAuthenticatedStorageState(browser);
    await use(storageState);
  },
});

export { expect };
