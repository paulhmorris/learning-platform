import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/authenticated-unenrolled";

test.describe("Purchase flow", () => {
  async function completeStripeCheckout(page: Page, email: string) {
    await expect(page).toHaveURL(/checkout\.stripe\.com/);
    await expect(page.getByRole("heading", { name: /payment method/i })).toBeVisible();

    const ensureCardFields = async () => {
      const cardRadio = page.getByRole("radio", { name: /card/i });
      if (await cardRadio.isVisible().catch(() => false)) {
        await cardRadio.check();
      }

      await page.evaluate(() => {
        const button = document.querySelector('[data-testid="card-accordion-item-button"]');
        if (button instanceof HTMLButtonElement) {
          button.click();
        }
      });
    };

    await ensureCardFields();

    const emailField = page.getByLabel(/email/i);
    if (await emailField.isVisible().catch(() => false)) {
      await emailField.fill(email);
    }

    const nameField = page.getByLabel(/name/i);
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill("E2E Test User");
    }

    const fillStripeInput = async (selector: string, value: string, optional = false) => {
      let target: ReturnType<Page["locator"]> | null = null;
      try {
        await expect
          .poll(
            async () => {
              await ensureCardFields();
              const pageLocator = page.locator(selector).first();
              if (await pageLocator.count()) {
                target = pageLocator;
                return true;
              }
              return false;
            },
            { timeout: optional ? 6000 : 20000, intervals: [500, 1000, 1500] },
          )
          .toBe(true);
      } catch {
        if (optional) {
          return;
        }
        throw new Error(`Unable to locate Stripe field for selector: ${selector}`);
      }

      await target!.fill(value);
    };

    await fillStripeInput(
      'input[name="cardNumber"], input[name="cardnumber"], input[autocomplete="cc-number"], input[placeholder*="1234"]',
      "4242 4242 4242 4242",
    );
    await fillStripeInput(
      'input[name="cardExpiry"], input[name="exp-date"], input[autocomplete="cc-exp"], input[placeholder*="MM"]',
      "12 / 34",
    );
    await fillStripeInput(
      'input[name="cardCvc"], input[name="cvc"], input[autocomplete="cc-csc"], input[placeholder="CVC"]',
      "123",
    );
    await fillStripeInput(
      'input[name="billingPostalCode"], input[name="postal"], input[autocomplete~="postal-code"], input[placeholder="ZIP"]',
      "12345",
      true,
    );

    const payButton = page.getByRole("button", { name: /pay|confirm|purchase|complete/i });
    await Promise.all([page.waitForURL(/\/preview\?purchase_success=true/), payButton.click()]);
  }

  test("completes checkout and enrolls the user", async ({ page, testUser }) => {
    await page.goto("/preview");

    const enrollButton = page.getByRole("button", { name: "Enroll" });
    await expect(enrollButton).toBeVisible();

    await Promise.all([page.waitForURL(/checkout\.stripe\.com/), enrollButton.click()]);

    await completeStripeCheckout(page, testUser.email);

    await expect(page.getByRole("heading", { name: "Congrats!" })).toBeVisible();
    await expect(page.getByText(/successfully enrolled/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Enroll" })).toHaveCount(0);
  });
});
