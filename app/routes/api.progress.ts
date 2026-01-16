import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { db } from "~/integrations/db.server";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { number } from "~/schemas/fields";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Api.LessonProgress");

const schema = z.object({
  lessonId: number,
  intent: z.enum(["mark-complete", "increment-duration"]),
});
export const SUBMIT_INTERVAL_MS = 30_000;

export function shouldRevalidate({ formAction }: ShouldRevalidateFunctionArgs) {
  if (formAction === "/api/progress") {
    return true;
  }

  return false;
}

export async function loader(args: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(args);
  try {
    const [lessonProgress, quizProgress] = await db.$transaction([
      db.userLessonProgress.findMany({
        select: { isCompleted: true, durationInSeconds: true, lessonId: true },
        where: { userId },
      }),
      db.userQuizProgress.findMany({
        select: { isCompleted: true, quizId: true, score: true },
        where: { userId },
      }),
    ]);
    return { lessonProgress, quizProgress };
  } catch (error) {
    logger.error(`Error loading lesson progress for user ${userId}`, { error });
    Sentry.captureException(error, { extra: { userId } });
    return Toasts.dataWithError(null, {
      message: "An error occurred trying to load your progress.",
      description: "If the problem persists, please contact support.",
    });
  }
}

export async function action(args: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(args);
  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { lessonId, intent } = result.data;

  try {
    const duration = await LessonService.getDuration(lessonId);

    // Lessons without required durations
    if (intent === "mark-complete" && !duration) {
      const progress = await ProgressService.markComplete({ userId, lessonId });
      return Toasts.dataWithSuccess(
        { progress },
        { message: "Lesson completed!", description: "You may now move on to the next item." },
      );
    }

    const progress = await ProgressService.getByLessonId(userId, lessonId);
    if (!duration) {
      return { progress };
    }

    // Completion flow
    if (progress && progress.durationInSeconds !== null) {
      if (progress.isCompleted) {
        return Toasts.dataWithInfo(null, {
          message: "Lesson already completed",
          description: "You can continue to the next item.",
        });
      }

      // TODO: prevent spamming the endpoint

      // Mark lesson complete if we're about to hit the required duration;
      if (progress.durationInSeconds + SUBMIT_INTERVAL_MS / 1_000 >= duration) {
        const completedProgress = await ProgressService.markComplete({
          userId,
          lessonId,
          requiredDurationInSeconds: duration,
        });
        return Toasts.dataWithSuccess(
          { progress: completedProgress },
          { message: "Lesson completed!", description: "You may now move on to the next item." },
        );
      }
    }

    // Upsert progress
    const currentProgress = await ProgressService.incrementProgress(userId, lessonId);

    return { progress: currentProgress };
  } catch (error) {
    logger.error(`Error processing lesson progress action for user ${userId} on lesson ${lessonId} (intent: ${intent})`, { error });
    Sentry.captureException(error, { extra: { userId, lessonId, intent } });

    if (error instanceof Response) {
      throw error;
    }

    return Toasts.dataWithError(null, {
      message: "An error occurred trying to save your progress.",
      description: "If the problem persists, please contact support.",
    });
  }
}
