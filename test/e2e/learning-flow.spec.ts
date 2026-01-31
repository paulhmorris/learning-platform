import { expect, test } from "./fixtures/authenticated";
import { getCourseLayoutForE2E, markLessonCompleteForUser, resetProgressForUser } from "./helpers/progress";

test.describe("Lesson flow", () => {
  test("marks a lesson complete and unlocks the next lesson", async ({ page, userId }) => {
    await resetProgressForUser(userId);

    const courseLayout = await getCourseLayoutForE2E();

    await page.goto("/preview");

    const upNextSection = page.getByRole("heading", { name: "Up next:" }).locator("..");
    const upNextStart = upNextSection.getByRole("link", { name: "Start" });

    const upNextHref = await upNextStart.getAttribute("href");

    const lessonSlug = upNextHref?.replace(/^\//, "");
    const allLessons = courseLayout.attributes.sections.flatMap((section) => section.lessons?.data ?? []);
    const activeLesson = allLessons.find((lesson) => lesson.attributes.slug === lessonSlug);

    const activeSection = courseLayout.attributes.sections.find((section) =>
      section.lessons?.data?.some((lesson) => lesson.id === activeLesson?.id),
    );
    const sectionLessons = activeSection?.lessons?.data ?? [];
    const activeLessonIndex = sectionLessons.findIndex((lesson) => lesson.id === activeLesson?.id);
    const nextLesson = sectionLessons[activeLessonIndex + 1];

    await upNextStart.click();

    const lessonHeading = page.getByRole("heading", { level: 1 });
    await expect(lessonHeading).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to overview" })).toBeVisible();

    await markLessonCompleteForUser(userId, activeLesson!);

    await page.reload();
    const activeLessonItem = page
      .getByRole("heading", { name: activeLesson?.attributes.title, level: 3 })
      .locator("xpath=ancestor::li[1]");
    await expect(activeLessonItem).toContainText(/completed/i);

    await page.getByRole("link", { name: "Back to overview" }).click();
    await expect(page).toHaveURL(/\/preview$/);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    const nextLessonItem = page
      .getByRole("heading", { name: nextLesson.attributes.title, level: 3 })
      .locator("xpath=ancestor::li[1]");
    await expect
      .poll(
        async () => {
          await page.reload();
          return nextLessonItem.getByRole("link", { name: "Start" }).isVisible();
        },
        { timeout: 20000, intervals: [500, 1000, 1500] },
      )
      .toBe(true);
  });
});
