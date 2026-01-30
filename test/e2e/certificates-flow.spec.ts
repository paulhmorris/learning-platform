import { clerk } from "@clerk/testing/playwright";

import { AuthService } from "~/services/auth.server";

import { expect, test } from "./fixtures/authenticated";
import {
  getCourseLayoutForE2E,
  markLessonCompleteForUser,
  markQuizPassedForUser,
  resetProgressForUser,
} from "./helpers/progress";

test.describe("Certificate flow", () => {
  async function completeCourse(userId: string) {
    const courseLayout = await getCourseLayoutForE2E();
    const lessons = courseLayout.attributes.sections.flatMap((section) => section.lessons?.data ?? []);
    const quizzes = courseLayout.attributes.sections
      .map((section) => section.quiz?.data)
      .filter((quiz): quiz is NonNullable<typeof quiz> => Boolean(quiz));

    await resetProgressForUser(userId);
    for (const lesson of lessons) {
      await markLessonCompleteForUser(userId, lesson);
    }
    for (const quiz of quizzes) {
      await markQuizPassedForUser(userId, quiz.id, 100);
    }
  }

  test("requires identity verification after completion", async ({ page, userId }) => {
    await completeCourse(userId);

    await page.goto("/certificate");

    await expect(page.getByText(/you must verify your identity before you can claim your certificate/i)).toBeVisible();
  });

  test("allows claim after identity verification", async ({ page, userId, testUser }) => {
    await completeCourse(userId);

    await AuthService.updatePublicMetadata(userId, { isIdentityVerified: true });

    await page.goto("/preview");
    await clerk.signOut({ page });

    await page.goto("/sign-in");
    await clerk.signIn({
      page,
      signInParams: {
        strategy: "password",
        identifier: testUser.email,
        password: testUser.password,
      },
    });

    await page.goto("/certificate");

    await expect(page.getByRole("button", { name: /claim certificate/i })).toBeVisible();
  });
});
