import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson, useTypedLoaderData, useTypedRouteLoaderData } from "remix-typedjson";
import { validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";

import { LessonContentRenderer } from "~/components/lesson-content-renderer";
import { PageTitle } from "~/components/page-title";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { badRequest, handlePrismaError, notFound, serverError } from "~/lib/responses.server";
import { loader as courseLoader } from "~/routes/_app.courses.$courseSlug";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseCollection, APIResponseData, TypedMetaFunction } from "~/types/utils";

export const SUBMIT_INTERVAL_MS = 15_000;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const lessonSlug = params.lessonSlug;
  invariant(lessonSlug, "Lesson slug is required");

  try {
    const lessonResult = await cms.find<APIResponseCollection<"api::lesson.lesson">["data"]>("lessons", {
      filters: {
        slug: lessonSlug,
      },
      fields: ["title"],
      populate: {
        content: {
          populate: "*",
        },
      },
    });

    if (lessonResult.data.length > 1) {
      throw serverError("Multiple courses with the same slug found.");
    }

    if (lessonResult.data.length === 0) {
      throw notFound("Course not found.");
    }

    const lesson = lessonResult.data[0];

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
      return typedjson({ progress: completedProgress });
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

export const meta: TypedMetaFunction<typeof loader, { "routes/_app.courses.$courseSlug": typeof courseLoader }> = ({
  data,
  matches,
}) => {
  // @ts-expect-error typed meta funtion not supporting this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "routes/_app.courses.$courseSlug")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `${data?.lesson.attributes.title} | ${match?.attributes.title}` }];
};

export default function Course() {
  const { lesson } = useTypedLoaderData<typeof loader>();
  const courseData = useTypedRouteLoaderData<typeof courseLoader>("routes/_app.courses.$courseSlug");

  if (!courseData) {
    throw new Error("Course data not found");
  }

  return (
    <>
      <PageTitle className="mb-8">{lesson.attributes.title}</PageTitle>
      <LessonContentRenderer content={lesson.attributes.content} />
    </>
  );
}
