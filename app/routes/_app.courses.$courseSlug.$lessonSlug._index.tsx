import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
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
import { APIResponseCollection, APIResponseData } from "~/types/utils";

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
  const progress = await db.userLessonProgress.findUnique({
    where: { userId_lessonId: { lessonId, userId } },
  });
  const { required_duration_in_seconds } = lesson.data.attributes;

  if (progress && progress.durationInSeconds !== null) {
    if (progress.isCompleted) {
      throw badRequest({ message: "Can't update progress on a lesson that's already completed." });
    }

    // Prevent spamming the endpoint
    const now = new Date().getTime();
    const lastUpdate = progress.updatedAt.getTime();

    if (now - lastUpdate < SUBMIT_INTERVAL_MS) {
      throw json({ message: "Progress updates were too close together." }, { status: 429 });
    }

    // Mark lesson complete if we're about to hit the required duration;
    if (
      required_duration_in_seconds !== undefined &&
      progress.durationInSeconds + SUBMIT_INTERVAL_MS / 1_000 >= required_duration_in_seconds
    ) {
      const completedProgress = await db.userLessonProgress.update({
        where: { id: progress.id },
        data: { isCompleted: true, durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 } },
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

  // Lessons without required durations
  if (!required_duration_in_seconds) {
    return typedjson({ progress: currentProgress });
  }

  // Lessons with required durations
  if (
    required_duration_in_seconds &&
    currentProgress.durationInSeconds !== null &&
    currentProgress.durationInSeconds >= required_duration_in_seconds
  ) {
    const progress = await db.userLessonProgress.update({
      where: { id: currentProgress.id },
      data: { isCompleted: true },
    });
    return typedjson({ progress });
  }

  return typedjson({ progress: currentProgress });
}

export default function Course() {
  const { lesson } = useTypedLoaderData<typeof loader>();
  const courseData = useTypedRouteLoaderData<typeof courseLoader>("routes/_app.courses.$courseSlug");

  if (!courseData) {
    throw new Error("Course data not found");
  }

  // useEffect(() => {
  //   console.log("data: ", courseData);
  // }, [courseData]);

  return (
    <>
      <PageTitle className="mb-8">{lesson.attributes.title}</PageTitle>
      <LessonContentRenderer content={lesson.attributes.content} />
    </>
  );
}
