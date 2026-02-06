import { test as base, expect } from "@playwright/test";

import { createE2ETestUser, deleteE2ETestUser, ensureAuthenticatedStorageState, TestUser } from "../helpers/auth";
import { cleanupUserCourseData } from "../helpers/progress";

type AuthFixtures = {
  storageState: string;
  userId: string;
};

type AuthWorkerFixtures = {
  testUser: TestUser;
};

export const test = base.extend<AuthFixtures, AuthWorkerFixtures>({
  testUser: [
    async ({}, use, workerInfo) => {
      const testUser = await createE2ETestUser(workerInfo.workerIndex);
      await use(testUser);
      await cleanupUserCourseData(testUser.id);
      await deleteE2ETestUser(testUser.id, testUser.stripeCustomerId);
    },
    { scope: "worker" },
  ],
  storageState: async ({ browser, testUser }, use, workerInfo) => {
    const storageState = await ensureAuthenticatedStorageState(browser, testUser, workerInfo.workerIndex, testUser.id);
    await use(storageState);
  },
  userId: async ({ testUser }, use) => {
    await use(testUser.id);
  },
});

export { expect };
