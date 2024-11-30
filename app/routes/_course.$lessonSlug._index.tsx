import { MetaFunction, useLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@vercel/remix";
import { validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { LessonContentRenderer, StrapiContent } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { MarkCompleteButton } from "~/components/lesson/mark-complete-button";
import { badRequest } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { loader as courseLoader } from "~/routes/_course";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

const validator = withZod(
  z.object({
    lessonId: z.coerce.number(),
    intent: z.enum(["mark-complete", "increment-duration"]),
  }),
);
export const SUBMIT_INTERVAL_MS = 15_000;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const lessonSlug = params.lessonSlug;
  invariant(lessonSlug, "Lesson slug is required");

  const lesson = await LessonService.getBySlugWithContent(lessonSlug);
  const progress = await ProgressService.getByLessonId(userId, lesson.id);
  const isTimed = lesson.attributes.required_duration_in_seconds && lesson.attributes.required_duration_in_seconds > 0;
  return json({ lesson, progress, isTimed });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);
  const result = await validator.validate(await request.formData());
  if (result.error) {
    throw validationError(result.error);
  }

  const { lessonId, intent } = result.data;

  const duration = await LessonService.getDuration(lessonId);

  // Lessons without required durations
  if (intent === "mark-complete" && !duration) {
    const progress = await ProgressService.markComplete({ userId, lessonId });
    return Toasts.jsonWithSuccess(
      { progress },
      { title: "Lesson completed!", description: "You may now move on to the next item." },
    );
  }

  const progress = await ProgressService.getByLessonId(userId, lessonId);
  if (!duration) {
    return json({ progress });
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
      return Toasts.jsonWithSuccess(
        { progress: completedProgress },
        { title: "Lesson completed!", description: "You may now move on to the next item." },
      );
    }
  }

  // Upsert progress
  const currentProgress = await ProgressService.incrementProgress(userId, lessonId);

  return json({ progress: currentProgress });
}

export const meta: MetaFunction<typeof loader, { "routes/_course": typeof courseLoader }> = ({ data, matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "routes/_course")?.data.course;
  return [{ title: `${data?.lesson.attributes.title} | ${match?.attributes.title}` }];
};

export default function Course() {
  const { lesson, progress, isTimed } = useLoaderData<typeof loader>();

  return (
    <>
      <PageTitle>{lesson.attributes.title}</PageTitle>
      <div className="my-4 lg:hidden">
        <LessonProgressBar
          duration={lesson.attributes.required_duration_in_seconds ?? 0}
          progress={progress?.durationInSeconds ?? 0}
        />
      </div>
      <div className="mt-8">
        <LessonContentRenderer content={lesson.attributes.content as StrapiContent} />
      </div>
      {!isTimed ? (
        <div className="mt-12 flex w-full justify-center">
          <MarkCompleteButton lessonId={lesson.id} isCompleted={Boolean(progress?.isCompleted)} />
        </div>
      ) : null}
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
