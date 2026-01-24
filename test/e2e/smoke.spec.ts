import { expect, test } from "./fixtures/authenticated";

test.use({ colorScheme: "dark" });

test.describe("Smoke Test", () => {
  test("Authenticated user can access preview page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/preview/);
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
    await expect(page.getByText(/certification upon completion/i)).toBeVisible();
  });

  test("Authenticated user can start a lesson", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });

    const upNextSection = page.getByRole("heading", { name: "Up next:" }).locator("..");
    const lessonName = await upNextSection.getByRole("heading", { level: 3 }).first().textContent();
    await upNextSection.getByRole("link", { name: "Start" }).click();

    await expect(page).not.toHaveURL(/\/preview/);
    await expect(page.getByRole("heading", { name: lessonName?.trim(), level: 1 })).toBeVisible();
  });

  test("All lessons after the first one are locked", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });

    const upNextSection = page.getByRole("heading", { name: "Up next:" }).locator("..");
    const unlockedLessons = page.locator('li[data-locked="false"]');

    await expect(upNextSection.getByRole("link", { name: "Start" })).toBeVisible();
    await expect(unlockedLessons).toHaveCount(1);
  });

  test("Authenticated user can access account page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: /account/i, level: 1 })).toBeVisible();
  });

  test("Authenticated user can access security page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await page.getByRole("button", { name: "Security" }).click();

    await expect(page).toHaveURL(/\/account\/security/);
    await expect(page.getByRole("heading", { name: /security/i, level: 1 })).toBeVisible();
  });

  test("Authenticated user can access identity page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await page.getByRole("button", { name: "Identity" }).click();

    await expect(page).toHaveURL(/\/account\/identity/);
    await expect(page.getByRole("heading", { name: /identity/i, level: 2 })).toBeVisible();
  });

  test("Authenticated user can access courses page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await page.getByRole("button", { name: "Courses" }).click();

    await expect(page).toHaveURL(/\/account\/courses/);
    await expect(page.getByText(/you are enrolled in/i)).toBeVisible();
    await expect(page.getByText(/incomplete/i)).toBeVisible();
  });

  test("Authenticated user can change color scheme", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: /set visual theme/i });
    const htmlElement = page.locator("html");
    await expect(button).toBeVisible();

    // Dark
    await button.click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(htmlElement).toHaveAttribute("data-theme", "dark");

    // Light
    await button.click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(htmlElement).toHaveAttribute("data-theme", "light");

    // System
    await button.click();
    await page.getByRole("menuitem", { name: "System" }).click();
    await expect(htmlElement).toHaveAttribute("data-theme", "dark");
  });
});
