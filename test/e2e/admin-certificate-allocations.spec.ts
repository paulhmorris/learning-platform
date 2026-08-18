import { test as userTest } from "./fixtures/authenticated";
import { test as adminTest, expect } from "./fixtures/authenticated-admin";
import {
  createAllocations,
  deleteAllocationsByPrefix,
  getAllocationNumbers,
  markAllocationUsed,
  uniqueNumberPrefix,
} from "./helpers/certificates";
import { gotoHydrated } from "./helpers/hydration";
import { ensureCourseHostForE2E } from "./helpers/progress";

adminTest.describe("Certificate number allocations", () => {
  adminTest("adds a range and lists every number in it", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();
    const start = `${prefix}100`;
    const end = `${prefix}102`;

    try {
      await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);

      await page.getByLabel("First number").first().fill(start);
      await page.getByLabel("Last number").first().fill(end);
      await page.getByRole("button", { name: "Add Range" }).click();

      await expect(page.getByText("Added 3 numbers")).toBeVisible();

      await page.getByPlaceholder("Search by number...").fill(prefix);
      for (const number of [start, `${prefix}101`, end]) {
        await expect(page.getByRole("row", { name: new RegExp(number) })).toBeVisible();
      }
      await expect(page.getByRole("row", { name: new RegExp(`${prefix}100`) }).getByText("Available")).toBeVisible();
    } finally {
      await deleteAllocationsByPrefix(course.id, prefix);
    }
  });

  adminTest("skips numbers the course already has instead of failing the batch", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();

    try {
      await createAllocations(course.id, [`${prefix}200`, `${prefix}201`]);

      await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);
      await page.getByLabel("First number").first().fill(`${prefix}200`);
      await page.getByLabel("Last number").first().fill(`${prefix}202`);
      await page.getByRole("button", { name: "Add Range" }).click();

      await expect(page.getByText("Added 1 number", { exact: true })).toBeVisible();
      await expect(page.getByText("2 already existed and were skipped.")).toBeVisible();
      expect(await getAllocationNumbers(course.id, prefix)).toHaveLength(3);
    } finally {
      await deleteAllocationsByPrefix(course.id, prefix);
    }
  });

  adminTest("rejects leading zeros so a number has one written form", async ({ page }) => {
    const course = await ensureCourseHostForE2E();

    await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);

    await page.getByLabel("First number").first().fill("0001");
    await page.getByLabel("Last number").first().fill("0003");
    await page.getByRole("button", { name: "Add Range" }).click();

    // Both fields are rejected, so scope to the first.
    await expect(page.getByText("Numbers only, without leading zeros").first()).toBeVisible();
    expect(await getAllocationNumbers(course.id, "0001")).toHaveLength(0);
  });

  adminTest("rejects a range larger than the per-submission limit", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();

    await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);

    await page.getByLabel("First number").first().fill(`${prefix}00000`);
    await page.getByLabel("Last number").first().fill(`${prefix}99999`);
    await page.getByRole("button", { name: "Add Range" }).click();

    await expect(page.getByText(/Ranges are limited to .* numbers at a time/)).toBeVisible();
    expect(await getAllocationNumbers(course.id, prefix)).toHaveLength(0);
  });

  adminTest("lists numbers in numeric order, not string order", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();
    // Differing lengths: string order would put 10 and 100 before 9.
    const numbers = [`${prefix}9`, `${prefix}10`, `${prefix}100`];

    try {
      await createAllocations(course.id, numbers);

      await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);
      await page.getByPlaceholder("Search by number...").fill(prefix);

      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText(`${prefix}9`);
      await expect(rows.nth(1)).toContainText(`${prefix}10`);
      await expect(rows.nth(2)).toContainText(`${prefix}100`);
    } finally {
      await deleteAllocationsByPrefix(course.id, prefix);
    }
  });

  adminTest("filters to available numbers only", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();
    const available = `${prefix}300`;
    const claimed = `${prefix}301`;

    try {
      await createAllocations(course.id, [available]);
      await createAllocations(course.id, [claimed]);
      await markAllocationUsed(course.id, claimed);

      await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);
      await page.getByPlaceholder("Search by number...").fill(prefix);
      await page.getByRole("button", { name: "Available", exact: true }).click();

      await expect(page.getByRole("row", { name: new RegExp(available) })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(claimed) })).toBeHidden();
    } finally {
      await deleteAllocationsByPrefix(course.id, prefix);
    }
  });

  adminTest("removes a single unused number after confirming", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();
    const number = `${prefix}400`;

    try {
      await createAllocations(course.id, [number]);

      await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);
      await page.getByPlaceholder("Search by number...").fill(prefix);

      const row = page.getByRole("row", { name: new RegExp(number) });
      await expect(row).toBeVisible();

      // Cancelling leaves the number in place.
      await row.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
      // Reopening mid-close animation would detach the button out from under the next click.
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(await getAllocationNumbers(course.id, prefix)).toHaveLength(1);

      await row.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Remove Number" }).click();

      await expect(page.getByText("Number removed.")).toBeVisible();
      expect(await getAllocationNumbers(course.id, prefix)).toHaveLength(0);
    } finally {
      await deleteAllocationsByPrefix(course.id, prefix);
    }
  });

  adminTest("removes a range of unused numbers but keeps claimed ones", async ({ page }) => {
    const course = await ensureCourseHostForE2E();
    const prefix = uniqueNumberPrefix();
    const unused = [`${prefix}500`, `${prefix}501`];
    const claimed = `${prefix}502`;

    try {
      await createAllocations(course.id, [...unused, claimed]);
      await markAllocationUsed(course.id, claimed);

      await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);

      await page.getByLabel("First number").nth(1).fill(`${prefix}500`);
      await page.getByLabel("Last number").nth(1).fill(`${prefix}502`);
      await page.getByRole("button", { name: "Remove Range" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(/Remove 3 numbers from/)).toBeVisible();
      await dialog.getByRole("button", { name: "Remove Numbers" }).click();

      await expect(page.getByText("Removed 2 numbers")).toBeVisible();
      // The claimed number is never deleted.
      expect(await getAllocationNumbers(course.id, prefix)).toEqual([claimed]);
    } finally {
      await deleteAllocationsByPrefix(course.id, prefix);
    }
  });
});

userTest.describe("Certificate allocations access control", () => {
  userTest("forbids non-admin users", async ({ page }) => {
    const course = await ensureCourseHostForE2E();

    await gotoHydrated(page, `/admin/courses/${course.id}/certificates`);

    await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  });
});
