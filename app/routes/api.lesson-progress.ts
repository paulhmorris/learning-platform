import { withZod } from "@remix-validated-form/with-zod";
import { validationError } from "@rvf/react-router";
import { ActionFunctionArgs } from "react-router";
import { z } from "zod";

import { badRequest } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

const schema = withZod(
  z.object({
    lessonId: z.coerce.number(),
    intent: z.enum(["mark-complete", "increment-duration"]),
  }),
);
export const SUBMIT_INTERVAL_MS = 15_000;

export async function action({ request }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);
  const result = await parseFormData(request, schema);
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
      throw badRequest({ message: "Can't update progress on a lesson that's already completed." });
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
