import { MetaFunction, useFetcher, useLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { IconLoader } from "@tabler/icons-react";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@vercel/remix";
import { validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { LessonContentRenderer, StrapiContent } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { Button } from "~/components/ui/button";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { badRequest } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { loader as courseLoader } from "~/routes/_course";
import { LessonService } from "~/services/lesson.server";
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
  const progress = await LessonService.getProgress(userId, lesson.id);
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
    const progress = await LessonService.markComplete({ userId, lessonId });
    return Toasts.jsonWithSuccess(
      { progress },
      { title: "Lesson completed!", description: "You may now move on to the next item." },
    );
  }

  const progress = await LessonService.getProgress(userId, lessonId);
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
      const completedProgress = await LessonService.markComplete({
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

  // Create or update progress
  const currentProgress = await db.userLessonProgress.upsert({
    where: { userId_lessonId: { lessonId, userId } },
    create: {
      lessonId,
      userId,
      durationInSeconds: SUBMIT_INTERVAL_MS / 1_000,
    },
    update: { durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 } },
  });
  await redis.set(`user-lesson-progress:${userId}:${lessonId}`, currentProgress, { ex: 12 });

  return json({ progress: currentProgress });
}

export const meta: MetaFunction<typeof loader, { "routes/_course": typeof courseLoader }> = ({ data, matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "routes/_course")?.data.course;
  return [{ title: `${data?.lesson.attributes.title} | ${match?.attributes.title}` }];
};

export default function Course() {
  const { lesson, progress, isTimed } = useLoaderData<typeof loader>();
  const markCompleteFetcher = useFetcher();
  const isSubmitting = markCompleteFetcher.state === "submitting" || markCompleteFetcher.state === "loading";

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
          <markCompleteFetcher.Form method="POST">
            <input type="hidden" name="lessonId" value={lesson.id} />
            <Button
              disabled={progress?.isCompleted || isSubmitting}
              variant="primary-md"
              className="w-auto"
              name="intent"
              value="mark-complete"
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Mark Complete</span>
            </Button>
          </markCompleteFetcher.Form>
        </div>
      ) : null}
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
