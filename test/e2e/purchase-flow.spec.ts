import { expect, test } from "./fixtures/authenticated-unenrolled";

test.describe.configure({ mode: "serial" });

test.describe("Purchase flow", () => {
  test("clicking Enroll starts a Stripe checkout session", async ({ page }) => {
    await page.goto("/preview");

    const enrollButton = page.getByRole("button", { name: "Enroll" });
    await expect(enrollButton).toBeVisible();

    await enrollButton.click();
    await page.waitForURL(/checkout\.stripe\.com/);
  });

  test("shows canceled modal when checkout is abandoned", async ({ page }) => {
    await page.goto("/preview?purchase_canceled=true");
    await page.waitForURL(/\/preview\?purchase_canceled=true/);

    // Verify the canceled modal appears.
    await expect(page.getByRole("heading", { name: "Something went wrong!" })).toBeVisible();
    await expect(page.getByText(/weren't able to purchase/i)).toBeVisible();

    // Close the modal so the underlying page is no longer inert.
    await page.getByRole("button", { name: "Close" }).first().click();

    // Verify the Enroll button is still present (user is not enrolled).
    await expect(page.getByRole("button", { name: "Enroll" })).toBeVisible();
  });
});
