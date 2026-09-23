import { expect, test } from "@playwright/test";

import { getCourseTitleForE2E } from "./helpers/progress";

test.describe("Auth", () => {
  let courseTitle: string;

  test.beforeAll(async () => {
    courseTitle = await getCourseTitleForE2E();
  });

  test("Sign up flow is accessible", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: `Sign in to ${courseTitle}` })).toBeVisible();
    await page.getByRole("link", { name: "Sign up" }).click();

    await expect(page).toHaveTitle(`Sign Up | ${courseTitle}`);
    await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create your account", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "First name" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Last name" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("Sign in flow is accessible", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveTitle(`Sign In | ${courseTitle}`);
    await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();
    await expect(page.getByText(courseTitle, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: `Sign in to ${courseTitle}` })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });
});
