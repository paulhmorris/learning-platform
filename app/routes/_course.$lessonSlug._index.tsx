import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";

import { PageTitle } from "~/components/common/page-title";
import { LessonContentRenderer } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { db } from "~/integrations/db.server";
import { redis } from "~/integrations/redis.server";
import { Sentry } from "~/integrations/sentry";
import { badRequest, handlePrismaError, serverError } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import {
  getLessonBySlugWithContent,
  getLessonDuration,
  getUserLessonProgress,
  setUserLessonProgressComplete,
} from "~/models/lesson.server";
import { loader as courseLoader } from "~/routes/_course";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

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

  try {
    const lesson = await getLessonBySlugWithContent(lessonSlug);
    const progress = await getUserLessonProgress(userId, lesson.id);
    return typedjson({ lesson, progress });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw error;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    throw validationError(result.error);
  }

  const { lessonId, userId } = result.data;

  try {
    const duration = await getLessonDuration(lessonId);
    // Lessons without required durations
    if (!duration) {
      return typedjson({ progress: null });
    }

    const progress = await getUserLessonProgress(userId, lessonId);

    // Completion flow
    if (progress && progress.durationInSeconds !== null) {
      if (progress.isCompleted) {
        throw badRequest({ message: "Can't update progress on a lesson that's already completed." });
      }

      // TODO: prevent spamming the endpoint

      // Mark lesson complete if we're about to hit the required duration;
      if (progress.durationInSeconds + SUBMIT_INTERVAL_MS / 1_000 >= duration) {
        const completedProgress = await setUserLessonProgressComplete({
          userId,
          lessonId,
          duration,
        });
        return toast.json(
          request,
          { progress: completedProgress },
          { title: "Lesson completed!", type: "success", description: "You may now move on to the next item." },
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

    return typedjson({ progress: currentProgress });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw serverError("Failed to update lesson progress.");
  }
}

export const meta: TypedMetaFunction<typeof loader, { "routes/_course": typeof courseLoader }> = ({
  data,
  matches,
}) => {
  // @ts-expect-error typed meta funtion not supporting this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "routes/_course")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `${data?.lesson.attributes.title} | ${match?.attributes.title}` }];
};

export default function Course() {
  const { lesson, progress } = useTypedLoaderData<typeof loader>();

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
        <LessonContentRenderer content={lesson.attributes.content} />
      </div>
    </>
  );
}
