import { expect, test } from "@playwright/test";

// Run tests unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login", () => {
  test("should login successfully", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@learnit.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).not.toHaveURL("/login");
  });
});
