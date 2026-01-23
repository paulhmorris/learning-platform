import { test as teardown } from "@playwright/test";

import { AuthService } from "~/services/auth.server";
import { ProgressService } from "~/services/progress.server";
import { QuizService } from "~/services/quiz.server";

import { getE2EUserId } from "./auth";

teardown("teardown database", async () => {
  console.log("Tearing down database...");
  const userId = await getE2EUserId();
  console.log(`Deleting data for user ${userId}`);
  await Promise.all([ProgressService.resetAllLesson(userId), QuizService.resetAllProgress(userId)]);

  await AuthService.updatePublicMetadata(userId, {
    stripeVerificationSessionId: null,
  });
});
