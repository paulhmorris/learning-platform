import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, data, LoaderFunctionArgs, ShouldRevalidateFunctionArgs } from "react-router";
import { z } from "zod/v4";

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
  const user = await SessionService.requireUser(args);
  try {
    // TODO: Clerk migration
    const [lessonProgress, quizProgress] = await Promise.all([
      ProgressService.getAllLesson(user.id),
      ProgressService.getAllQuiz(user.id),
    ]);
    return { lessonProgress, quizProgress };
  } catch (error) {
    logger.error("Error loading lesson progress", { error, userId: user.id });
    Sentry.captureException(error, { extra: { userId: user.id } });
    return Toasts.dataWithError(null, {
      message: "An error occurred trying to load your progress.",
      description: "If the problem persists, please contact support.",
    });
  }
}

export async function action(args: ActionFunctionArgs) {
  // TODO: Clerk migration
  const user = await SessionService.requireUser(args);
  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { lessonId, intent } = result.data;

  try {
    const duration = await LessonService.getDuration(lessonId);

    // Lessons without required durations
    if (intent === "mark-complete" && !duration) {
      const progress = await ProgressService.markComplete({ userId: user.id, lessonId });
      return data({
        progress,
        toast: {
          type: "success" as const,
          message: "Lesson completed!",
          description: "You may now move on to the next item.",
        },
      });
    }

    const progress = await ProgressService.getByLessonId(user.id, lessonId);
    if (!duration) {
      return { progress };
    }

    // Completion flow
    if (progress && progress.durationInSeconds !== null) {
      if (progress.isCompleted) {
        return data({
          progress: null,
          toast: {
            type: "info" as const,
            message: "Lesson already completed",
            description: "You can continue to the next item.",
          },
        });
      }

      // TODO: prevent spamming the endpoint

      // Mark lesson complete if we're about to hit the required duration;
      if (progress.durationInSeconds + SUBMIT_INTERVAL_MS / 1_000 >= duration) {
        const completedProgress = await ProgressService.markComplete({
          userId: user.id,
          lessonId,
          requiredDurationInSeconds: duration,
        });
        return data({
          progress: completedProgress,
          toast: {
            type: "success" as const,
            message: "Lesson completed!",
            description: "You may now move on to the next item.",
          },
        });
      }
    }

    // Upsert progress
    const currentProgress = await ProgressService.incrementProgress(user.id, lessonId);

    return { progress: currentProgress };
  } catch (error) {
    logger.error(
      `Error processing lesson progress action for user ${user.id} on lesson ${lessonId} (intent: ${intent})`,
      { error },
    );
    Sentry.captureException(error, { extra: { userId: user.id, lessonId, intent } });

    if (error instanceof Response) {
      throw error;
    }

    return data({
      progress: null,
      toast: {
        type: "error" as const,
        message: "An error occurred trying to save your progress.",
        description: "If the problem persists, please contact support.",
      },
    });
  }
}
