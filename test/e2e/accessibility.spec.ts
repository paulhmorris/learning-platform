import { AxeBuilder } from "@axe-core/playwright";
import { test as base } from "@playwright/test";

import { expect, test, WCAG_TAGS } from "./fixtures/accessibility";

base.describe("Sign-in page", () => {
  base("has no accessibility violations", async ({ page }) => {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});

base.describe("Sign-up page", () => {
  base("has no accessibility violations", async ({ page }) => {
    await page.goto("/sign-up", { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Preview page", () => {
  test.use({ colorScheme: "light" });

  test("has no accessibility violations", async ({ page, makeAxeBuilder }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test("user menu has no accessibility violations when open", async ({ page, makeAxeBuilder }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open User Menu" }).click();
    await page.getByRole("menu").waitFor({ state: "visible" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test("theme switcher menu has no accessibility violations when open", async ({ page, makeAxeBuilder }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /set visual theme/i }).click();
    await page.getByRole("menu").waitFor({ state: "visible" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Account pages", () => {
  test.use({ colorScheme: "light" });

  test("account page has no accessibility violations", async ({ page, makeAxeBuilder }) => {
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test("account security page has no accessibility violations", async ({ page, makeAxeBuilder }) => {
    await page.goto("/account/security", { waitUntil: "domcontentloaded" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test("account identity page has no accessibility violations", async ({ page, makeAxeBuilder }) => {
    await page.goto("/account/identity", { waitUntil: "domcontentloaded" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test("account courses page has no accessibility violations", async ({ page, makeAxeBuilder }) => {
    await page.goto("/account/courses", { waitUntil: "domcontentloaded" });
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("Lesson page", () => {
  test.use({ colorScheme: "light" });

  test("first lesson page has no accessibility violations", async ({ page, makeAxeBuilder }) => {
    await page.goto("/preview", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Start" }).nth(1).click();
    await page.waitForLoadState("domcontentloaded");
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });
});
