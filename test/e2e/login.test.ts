import { expect, test } from "@playwright/test";

// Run tests unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Login Page", () => {
  test("should login successfully", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@learnit.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).not.toHaveURL("/login");
  });

  test("should not login with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByRole("textbox", { name: "Email" });
    const password = page.getByRole("textbox", { name: "Password" });
    await email.fill("invalid@email.com");
    await password.fill("valid-password");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(email).toBeFocused();
    await expect(password).not.toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
  });

  test("should not login with empty credentials", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByRole("textbox", { name: "Email" });
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL("/login");
    await expect(email).toBeFocused();
  });

  test("should login with 'keep me logged in' checked", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@learnit.com");
    await page.getByRole("textbox", { name: "Password" }).fill("password");
    await page.getByRole("checkbox", { name: /stay logged in/i }).check();
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).not.toHaveURL("/login");
  });

  test("should have a link to forgot password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot password/i }).click();

    await expect(page).toHaveURL(/passwords/);
  });

  test("should have a link to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /sign up/i }).click();

    await expect(page).toHaveURL(/join/);
  });
});
