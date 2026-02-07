import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/authenticated-unenrolled";

test.describe("Purchase flow", () => {
  async function completeStripeCheckout(page: Page) {
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    await expect(page.getByRole("heading", { name: /payment method/i })).toBeVisible();

    // The card radio input is covered by Stripe's accordion overlay button, so a
    // normal .check() / .click() will time out. dispatchEvent bypasses the overlay.
    await page.getByLabel("Pay with card").dispatchEvent("click");

    // Wait for the card form fields to appear after expanding the accordion.
    await expect(page.getByRole("textbox", { name: "Card number" })).toBeVisible();

    // Fill card details using Stripe's accessible textbox labels.
    await page.getByRole("textbox", { name: "Card number" }).fill("4242 4242 4242 4242");
    await page.getByRole("textbox", { name: "Expiration" }).fill("12 / 34");
    await page.getByRole("textbox", { name: "CVC" }).fill("123");

    // Fill billing address fields.
    await page.getByRole("textbox", { name: "Cardholder name" }).fill("E2E Test User");
    const zipField = page.getByRole("textbox", { name: "ZIP" });
    if (await zipField.isVisible().catch(() => false)) {
      await zipField.fill("12345");
    }

    // Uncheck "Save my information" to avoid the phone-number requirement.
    const saveCheckbox = page.getByRole("checkbox", { name: /save my information/i });
    if (await saveCheckbox.isChecked().catch(() => false)) {
      await saveCheckbox.uncheck();
    }

    // Submit payment and wait for the redirect back to the app.
    await page.getByTestId("hosted-payment-submit-button").click();
    await page.waitForURL(/\/preview\?purchase_success=true/, { timeout: 30_000 });
  }

  test("shows canceled modal when checkout is abandoned", async ({ page }) => {
    await page.goto("/preview");

    const enrollButton = page.getByRole("button", { name: "Enroll" });
    await expect(enrollButton).toBeVisible();

    await Promise.all([page.waitForURL(/checkout\.stripe\.com/), enrollButton.click()]);

    // Click "Back to Cosmic Development LLC" link to cancel checkout.
    await page.getByRole("link", { name: /back to/i }).click();
    await page.waitForURL(/\/preview\?purchase_canceled=true/);

    // Verify the canceled modal appears.
    await expect(page.getByRole("heading", { name: "Something went wrong!" })).toBeVisible();
    await expect(page.getByText(/weren't able to purchase/i)).toBeVisible();

    // Close the modal so the underlying page is no longer inert.
    await page.getByRole("button", { name: "Close" }).first().click();

    // Verify the Enroll button is still present (user is not enrolled).
    await expect(page.getByRole("button", { name: "Enroll" })).toBeVisible();
  });

  test("completes checkout and enrolls the user", async ({ page }) => {
    await page.goto("/preview");

    const enrollButton = page.getByRole("button", { name: "Enroll" });
    await expect(enrollButton).toBeVisible();

    await Promise.all([page.waitForURL(/checkout\.stripe\.com/), enrollButton.click()]);

    await completeStripeCheckout(page);

    await expect(page.getByRole("heading", { name: "Congrats!" })).toBeVisible();
    await expect(page.getByText(/successfully enrolled/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Enroll" })).toHaveCount(0);
  });
});
