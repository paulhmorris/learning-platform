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
import { cms, getLessonBySlug } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { badRequest, handlePrismaError } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import { loader as courseLoader } from "~/routes/_course";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData, TypedMetaFunction } from "~/types/utils";

export const SUBMIT_INTERVAL_MS = 15_000;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const lessonSlug = params.lessonSlug;
  invariant(lessonSlug, "Lesson slug is required");

  try {
    const lesson = await getLessonBySlug(lessonSlug);

    const progress = await db.userLessonProgress.findUnique({
      where: {
        userId_lessonId: {
          lessonId: lesson.id,
          userId,
        },
      },
    });

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

const validator = withZod(
  z.object({
    userId: z.string().cuid(),
    lessonId: z.coerce.number(),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    throw validationError(result.error);
  }

  const { lessonId, userId } = result.data;

  const lesson = await cms.findOne<APIResponseData<"api::lesson.lesson">>("lessons", lessonId);
  // Lessons without required durations
  const { required_duration_in_seconds } = lesson.data.attributes;
  if (!required_duration_in_seconds) {
    return typedjson({ progress: null });
  }

  const progress = await db.userLessonProgress.findUnique({
    where: { userId_lessonId: { lessonId, userId } },
  });

  // Completion flow
  if (progress && progress.durationInSeconds !== null) {
    if (progress.isCompleted) {
      throw badRequest({ message: "Can't update progress on a lesson that's already completed." });
    }

    // TODO: prevent spamming the endpoint

    // Mark lesson complete if we're about to hit the required duration;
    if (progress.durationInSeconds + SUBMIT_INTERVAL_MS / 1_000 >= required_duration_in_seconds) {
      const completedProgress = await db.userLessonProgress.update({
        where: { id: progress.id },
        data: { isCompleted: true, durationInSeconds: required_duration_in_seconds },
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

  return typedjson({ progress: currentProgress });
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
