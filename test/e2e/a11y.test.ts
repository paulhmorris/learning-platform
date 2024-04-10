import { expect, test } from "./helpers/axe-test";

test("Login should not have any automatically detectable a11y issues", async ({ page, makeAxeBuilder }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/login/);
  const accessibilityScanResults = await makeAxeBuilder().analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("Register should not have any automatically detectable a11y issues", async ({ page, makeAxeBuilder }) => {
  await page.goto("/join");
  await expect(page).toHaveURL(/join/);
  const accessibilityScanResults = await makeAxeBuilder().analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
