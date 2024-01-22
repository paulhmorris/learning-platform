import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";

// Run tests unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Register Page", () => {
  test("should successfully register a user", async ({ page }) => {
    const user = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      password: faker.internet.password({ length: 8 }),
    };
    await page.goto("/join");
    await page.getByRole("textbox", { name: "First Name" }).fill(user.firstName);
    await page.getByRole("textbox", { name: "Last Name" }).fill(user.lastName);
    await page.getByRole("textbox", { name: "Email" }).fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill(user.password);
    await page.getByRole("button", { name: "Sign Up" }).click();

    // TODO: Update expectations once implemented
    await expect(page).not.toHaveURL("/join");
  });

  // test("should not login with invalid credentials", async ({ page }) => {
  //   await page.goto("/join");
  //   const email = page.getByRole("textbox", { name: "Email" });
  //   const password = page.getByRole("textbox", { name: "Password" });
  //   await email.fill("invalid@email.com");
  //   await password.fill("valid-password");
  //   await page.getByRole("button", { name: /log in/i }).click();

  //   await expect(email).toBeFocused();
  //   await expect(password).not.toBeFocused();
  //   await expect(email).toHaveAttribute("aria-invalid", "true");
  // });

  // test("should not login with empty credentials", async ({ page }) => {
  //   await page.goto("/join");
  //   const email = page.getByRole("textbox", { name: "Email" });
  //   await page.getByRole("button", { name: /log in/i }).click();

  //   await expect(page).toHaveURL("/join");
  //   await expect(email).toBeFocused();
  // });

  // test("should login with 'keep me logged in' checked", async ({ page }) => {
  //   await page.goto("/join");
  //   await page.getByRole("textbox", { name: "Email" }).fill("e2e@learnit.com");
  //   await page.getByRole("textbox", { name: "Password" }).fill("password");
  //   await page.getByRole("checkbox", { name: /stay logged in/i }).check();
  //   await page.getByRole("button", { name: /log in/i }).click();

  //   await expect(page).not.toHaveURL("/join");
  // });

  // test("should have a link to forgot password", async ({ page }) => {
  //   await page.goto("/join");
  //   await page.getByRole("link", { name: /forgot password/i }).click();

  //   await expect(page).toHaveURL(/passwords/);
  // });

  // test("should have a link to sign in", async ({ page }) => {
  //   await page.goto("/join");
  //   await page.getByRole("link", { name: /sign up/i }).click();

  //   await expect(page).toHaveURL(/join/);
  // });
});
