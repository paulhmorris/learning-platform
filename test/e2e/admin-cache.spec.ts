import { randomUUID } from "node:crypto";

import { test as userTest } from "./fixtures/authenticated";
import { test as adminTest, expect } from "./fixtures/authenticated-admin";
import { deleteCacheKey, e2eCacheKey, seedCacheKey } from "./helpers/cache";
import { gotoHydrated } from "./helpers/hydration";

adminTest.describe("Admin cache page", () => {
  adminTest("lists a cache item and deletes it via the confirmation dialog", async ({ page }) => {
    const key = e2eCacheKey(randomUUID());
    await seedCacheKey(key);

    try {
      await gotoHydrated(page, "/admin/cache");

      await expect(page.getByRole("link", { name: "Cache" })).toHaveAttribute("aria-current", "page");

      // Filter down to our seeded key in case real course/lesson caches are also present.
      await page.getByPlaceholder("Search...").fill(key);
      const row = page.getByRole("row", { name: new RegExp(key) });
      await expect(row).toBeVisible();
      await expect(row.getByText(/^\d|No expiration/)).toBeVisible();

      // Cancel should leave the item in place.
      await row.getByRole("button", { name: "Delete cache item" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(key)).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(row).toBeVisible();

      // Confirming should delete the item and remove it from the table.
      await row.getByRole("button", { name: "Delete cache item" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

      await expect(page.getByText("Cache item deleted.")).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(key) })).toBeHidden();
    } finally {
      await deleteCacheKey(key);
    }
  });
});

userTest.describe("Admin cache page access control", () => {
  userTest("forbids non-admin users", async ({ page }) => {
    await gotoHydrated(page, "/admin/cache");
    await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  });
});
