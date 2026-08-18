import { test as userTest } from "./fixtures/authenticated";
import { test as adminTest, expect } from "./fixtures/authenticated-admin";
import {
  cleanupCertificateDataForUser,
  deleteAllocationsByPrefix,
  seedIssuedCertificate,
  uniqueNumberPrefix,
} from "./helpers/certificates";
import { gotoHydrated } from "./helpers/hydration";
import { ensureCourseHostForE2E } from "./helpers/progress";

/**
 * Saving queues a real regeneration job, so these stop at the point of submission: everything up to
 * and including client-side validation is covered here, and the job itself is covered by unit tests.
 */
adminTest.describe("Certificate amendment page", () => {
  adminTest("prefills the student's existing answers", async ({ page, userId }) => {
    const number = `${uniqueNumberPrefix()}700`;
    const { courseId } = await seedIssuedCertificate(userId, { number });

    try {
      await gotoHydrated(page, `/admin/users/${userId}/certificate/${courseId}`);

      await expect(page.getByRole("heading", { name: "Edit Certificate" })).toBeVisible();
      await expect(page.getByText(new RegExp(`Certificate #${number}`))).toBeVisible();
      await expect(page.getByText("Not yet reported to the state")).toBeVisible();

      await expect(page.getByLabel("First Name")).toHaveValue("Jane");
      await expect(page.getByLabel("Last Name")).toHaveValue("Doe");
      await expect(page.getByLabel("City")).toHaveValue("Austin");
      // reasonCode "T" is Ticket Dismissal, which is the only reason that asks for a court.
      await expect(page.getByLabel("Court Name")).toHaveValue("Travis County");
    } finally {
      await cleanupCertificateDataForUser(userId);
      await deleteAllocationsByPrefix(courseId, number.slice(0, 6));
    }
  });

  adminTest("warns when the stored answers are missing or unusable", async ({ page, userId }) => {
    const number = `${uniqueNumberPrefix()}701`;
    const { courseId } = await seedIssuedCertificate(userId, { number, formData: { firstName: "Jane" } });

    try {
      await gotoHydrated(page, `/admin/users/${userId}/certificate/${courseId}`);

      await expect(page.getByText(/answers are missing or no longer valid/i)).toBeVisible();
      await expect(page.getByLabel("First Name")).toHaveValue("");
    } finally {
      await cleanupCertificateDataForUser(userId);
      await deleteAllocationsByPrefix(courseId, number.slice(0, 6));
    }
  });

  adminTest("will not submit an incomplete amendment", async ({ page, userId }) => {
    const number = `${uniqueNumberPrefix()}702`;
    const { courseId } = await seedIssuedCertificate(userId, { number });

    try {
      await gotoHydrated(page, `/admin/users/${userId}/certificate/${courseId}`);

      await page.getByLabel("First Name").fill("");
      await page.getByRole("button", { name: "Save and Regenerate" }).click();

      await expect(page.getByText("Please enter your first name.")).toBeVisible();
      await expect(page.getByText(/Regenerating certificate/)).toBeHidden();
    } finally {
      await cleanupCertificateDataForUser(userId);
      await deleteAllocationsByPrefix(courseId, number.slice(0, 6));
    }
  });

  adminTest("404s for a student with no issued certificate", async ({ page, userId }) => {
    const course = await ensureCourseHostForE2E();

    await gotoHydrated(page, `/admin/users/${userId}/certificate/${course.id}`);

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit Certificate" })).toBeHidden();
  });
});

userTest.describe("Certificate amendment access control", () => {
  userTest("forbids non-admin users", async ({ page, userId }) => {
    const course = await ensureCourseHostForE2E();

    await gotoHydrated(page, `/admin/users/${userId}/certificate/${course.id}`);

    await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  });
});
