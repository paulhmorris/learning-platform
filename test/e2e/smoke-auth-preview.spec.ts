import { expect, test } from "./fixtures/authenticated";

test("authenticated user can access preview page", async ({ page }) => {
  await page.goto("/preview", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/preview/);
  await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible();
  await expect(page.getByText(/certification upon completion/i)).toBeVisible();
});
