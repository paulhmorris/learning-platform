import { expect, test } from "./fixtures/authenticated";
import {
  getCourseLayoutForE2E,
  markLessonCompleteForUser,
  markQuizPassedForUser,
  resetProgressForUser,
} from "./helpers/progress";

test.describe("Quiz flow", () => {
  test("completes section lessons, unlocks quiz, and unlocks next section", async ({ page, userId }) => {
    await resetProgressForUser(userId);

    const courseLayout = await getCourseLayoutForE2E();
    const sections = courseLayout.attributes.sections;
    const sectionIndex = sections.findIndex((section) => Boolean(section.quiz?.data));

    expect(sectionIndex).toBeGreaterThanOrEqual(0);

    const sectionWithQuiz = sections[sectionIndex];
    const nextSection = sections[sectionIndex + 1];
    expect(nextSection?.lessons?.data?.length).toBeTruthy();

    const sectionsToComplete = sections.slice(0, sectionIndex + 1);
    for (const section of sectionsToComplete) {
      const lessons = section.lessons?.data ?? [];
      for (const lesson of lessons) {
        await markLessonCompleteForUser(userId, lesson);
      }
    }

    await page.goto("/preview");
    await page.waitForLoadState("networkidle");

    const quizId = sectionWithQuiz.quiz?.data?.id;
    expect(quizId).toBeTruthy();
    await markQuizPassedForUser(userId, quizId!, 100);

    await page.reload();
    await page.waitForLoadState("networkidle");

    const sectionHeading = page.getByRole("heading", { name: sectionWithQuiz.title, level: 2 });
    const sectionItem = sectionHeading.locator("xpath=ancestor::li[1]");
    await expect(sectionItem.locator(`a[href="/quizzes/${quizId}"]`)).toBeVisible();

    const nextLesson = nextSection?.lessons?.data?.[0];
    expect(nextLesson).toBeTruthy();
    const nextLessonItem = page
      .getByRole("heading", { name: nextLesson!.attributes.title, level: 3 })
      .locator("xpath=ancestor::li[1]");
    await expect(nextLessonItem.getByRole("link", { name: "Start" })).toBeVisible();
  });
});
