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
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { badRequest } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cacheHeader } from "~/lib/utils";
import { loader as courseLoader } from "~/routes/_course";
import { LessonService } from "~/services/lesson.server";
import { SessionService } from "~/services/session.server";

const validator = withZod(
  z.object({
    userId: z.string().cuid(),
    lessonId: z.coerce.number(),
  }),
);
export const SUBMIT_INTERVAL_MS = 15_000;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const lessonSlug = params.lessonSlug;
  invariant(lessonSlug, "Lesson slug is required");

  const lesson = await LessonService.getBySlugWithContent(lessonSlug);
  const progress = await LessonService.getProgress(userId, lesson.id);
  return json({ lesson, progress }, { headers: cacheHeader(15) });
}

export async function action({ request }: ActionFunctionArgs) {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    throw validationError(result.error);
  }

  const { lessonId, userId } = result.data;

  const duration = await LessonService.getDuration(lessonId);
  // Lessons without required durations
  if (!duration) {
    return json({ progress: null });
  }

  const progress = await LessonService.getProgress(userId, lessonId);

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
  const { lesson, progress } = useLoaderData<typeof loader>();

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
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
