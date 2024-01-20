import { expect, test } from "./axe-test";
test.describe("Login", () => {
  test("should not have any automatically detectable a11y issues", async ({ page, makeAxeBuilder }) => {
    await page.goto("/login");
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
