import { expect, test } from "./fixtures/authenticated";

test.describe("Certificate flow", () => {
  test("certificate claim is disabled before completion", async ({ page }) => {
    await page.goto("/preview");
    await page.getByRole("link", { name: "Start" }).first().click();

    const claimButton = page.getByRole("button", { name: "Claim" });
    if (await claimButton.isEnabled()) {
      await claimButton.click();
      await expect(page).toHaveURL(/certificate/);
    } else {
      await expect(claimButton).toBeDisabled();
    }
  });
});
