import { expect, test } from "@playwright/test";

test.describe("Healthcheck", () => {
  test("returns OK", async ({ page }) => {
    const response = await page.goto("/healthcheck");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toHaveText("OK");
  });
});
