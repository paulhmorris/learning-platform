import { expect, test } from "./fixtures/authenticated";

test.describe("Newly signed up user flow", () => {
  test("Up next matches first available lesson and start links work", async ({ page }) => {
    await page.goto("/preview");

    const upNextSection = page.getByRole("heading", { name: "Up next:" }).locator("..");
    const upNextTitle = upNextSection.getByRole("heading", { level: 3 }).first();
    const upNextStart = upNextSection.getByRole("link", { name: "Start" });

    const firstLessonStart = page.getByRole("link", { name: "Start" }).nth(1);
    const firstLessonTitle = firstLessonStart.locator("xpath=preceding::h3[1]");

    const upNextTitleText = (await upNextTitle.textContent())?.trim() ?? "";
    const firstLessonTitleText = (await firstLessonTitle.textContent())?.trim() ?? "";

    expect(upNextTitleText).toBeTruthy();
    expect(firstLessonTitleText).toBeTruthy();
    expect(upNextTitleText).toBe(firstLessonTitleText);

    const upNextHref = await upNextStart.getAttribute("href");
    await upNextStart.click();
    await expect(page).toHaveURL(new RegExp(`${upNextHref ?? ""}$`));
    await expect(page.getByRole("heading", { name: upNextTitleText, level: 1 })).toBeVisible();

    await page.goto("/preview");

    const listStartLink = page.getByRole("link", { name: "Start" }).nth(1);
    const listStartTitle = listStartLink.locator("xpath=preceding::h3[1]");
    const listStartTitleText = (await listStartTitle.textContent())?.trim() ?? "";
    const firstLessonHref = await listStartLink.getAttribute("href");
    await listStartLink.click();
    await expect(page).toHaveURL(new RegExp(`${firstLessonHref ?? ""}$`));
    await expect(page.getByRole("heading", { name: listStartTitleText, level: 1 })).toBeVisible();
  });
});
