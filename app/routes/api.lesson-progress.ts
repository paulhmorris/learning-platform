import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { number } from "~/schemas/fields";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

const schema = z.object({
  lessonId: number,
  intent: z.enum(["mark-complete", "increment-duration"]),
});
export const SUBMIT_INTERVAL_MS = 15_000;

export async function action(args: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(args);
  const result = await parseFormData(args.request, schema);
  if (result.error) {
    throw validationError(result.error);
  }

  const { lessonId, intent } = result.data;

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
      throw Responses.conflict();
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
}

export const shouldRevalidate = () => false;
