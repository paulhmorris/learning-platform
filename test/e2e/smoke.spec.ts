import { expect, test } from "./fixtures/authenticated";
import { resetProgressForUser } from "./helpers/progress";

test.use({ colorScheme: "light" });

test.describe("Smoke Test", () => {
  test.beforeEach(async ({ userId }) => {
    await resetProgressForUser(userId);
  });

  test("User can access preview page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/preview/);
    await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
    await expect(page.getByText(/certification upon completion/i)).toBeVisible();
  });

  test("User can start a lesson", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });

    const upNextSection = page.getByRole("heading", { name: "Up next:" }).locator("..");
    const upNextTitle = upNextSection.getByRole("heading", { level: 3 }).first();
    const upNextStart = upNextSection.getByRole("link", { name: "Start" });

    const firstLessonStart = page.getByRole("link", { name: "Start" }).nth(1);
    const firstLessonTitle = firstLessonStart.locator("xpath=preceding::h3[1]");

    const upNextTitleText = (await upNextTitle.textContent())?.trim() ?? "";
    const firstLessonTitleText = (await firstLessonTitle.textContent())?.trim() ?? "";

    expect(upNextTitleText).toBeTruthy();
    expect(firstLessonTitleText).toBeTruthy();
    expect(upNextTitleText).toBe(firstLessonTitleText);

    const upNextHref = await upNextStart.getAttribute("href");
    await upNextStart.click();
    await expect(page).toHaveURL(new RegExp(`${upNextHref ?? ""}$`));
    await expect(page.getByRole("heading", { name: upNextTitleText, level: 1 })).toBeVisible();

    await page.goto("/preview");

    const listStartLink = page.getByRole("link", { name: "Start" }).nth(1);
    const listStartTitle = listStartLink.locator("xpath=preceding::h3[1]");
    const listStartTitleText = (await listStartTitle.textContent())?.trim() ?? "";
    const firstLessonHref = await listStartLink.getAttribute("href");
    await listStartLink.click();
    await expect(page).toHaveURL(new RegExp(`${firstLessonHref ?? ""}$`));
    await expect(page.getByRole("heading", { name: listStartTitleText, level: 1 })).toBeVisible();
  });

  test("All lessons after the first one are locked", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });

    const upNextSection = page.getByRole("heading", { name: "Up next:" }).locator("..");
    const unlockedLessons = page.locator('li[data-locked="false"]');

    await expect(upNextSection.getByRole("link", { name: "Start" })).toBeVisible();
    await expect(unlockedLessons).toHaveCount(1);
  });

  test("User can access account page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(page.getByRole("heading", { name: /account/i, level: 1 })).toBeVisible();
  });

  test("User can access security page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await page.getByRole("button", { name: "Security" }).click();

    await expect(page).toHaveURL(/\/account\/security/);
    await expect(page.getByRole("heading", { name: /security/i, level: 1 })).toBeVisible();
  });

  test("User can access identity page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await page.getByRole("button", { name: "Identity" }).click();

    await expect(page).toHaveURL(/\/account\/identity/);
    await expect(page.getByRole("heading", { name: /identity/i, level: 2 })).toBeVisible();
  });

  test("User can access courses page", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await page.getByRole("button", { name: "Courses" }).click();

    await expect(page).toHaveURL(/\/account\/courses/);
    await expect(page.getByText(/you are enrolled in/i)).toBeVisible();
    await expect(page.getByText(/incomplete/i)).toBeVisible();
  });

  test("User can change color scheme", async ({ page }) => {
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
    await expect(htmlElement).toHaveAttribute("data-theme", "light");
  });

  test("Theme persists across page reload", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: /set visual theme/i });
    const htmlElement = page.locator("html");

    // Switch to light theme.
    await button.click();
    await page.getByRole("menuitem", { name: "Light" }).click();
    await expect(htmlElement).toHaveAttribute("data-theme", "light");

    // Reload the page and verify theme is still light.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(htmlElement).toHaveAttribute("data-theme", "light");

    // Reset to system for other tests.
    await button.click();
    await page.getByRole("menuitem", { name: "System" }).click();
    await expect(htmlElement).toHaveAttribute("data-theme", "light");
  });

  test("User can sign out and is redirected to sign in", async ({ page }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menuitem", { name: /log out/i }).click();

    // After sign-out, navigating to a protected route should redirect to sign-in.
    await page.goto("/preview");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
