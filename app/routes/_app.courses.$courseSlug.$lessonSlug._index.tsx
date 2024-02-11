import MuxPlayer from "@mux/mux-player-react";
import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { BlocksRenderer } from "@strapi/blocks-react-renderer";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { validationError } from "remix-validated-form";
import invariant from "tiny-invariant";
import { z } from "zod";

import { PageTitle } from "~/components/page-header";
import { ProgressTimer } from "~/components/sidebar/progress-timer";
import { Lesson, cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { badRequest, handlePrismaError, serverError } from "~/lib/responses.server";
import { useUser } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

export const SUBMIT_INTERVAL_MS = 15_000;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const courseSlug = params.courseSlug;
  const lessonSlug = params.lessonSlug;
  invariant(courseSlug, "Course slug is required");
  invariant(lessonSlug, "Lesson slug is required");

  try {
    const db_lesson = await db.lesson.findUniqueOrThrow({ where: { slug: lessonSlug } });
    const cms_lesson = await cms.findOne<Lesson>("lessons", db_lesson.strapiId, {
      fields: ["title", "short_description", "text_content"],
      populate: {
        video: {
          populate: true,
        },
      },
    });

    const progress = await db.userLessonProgress.findUnique({
      where: { userId, lessonId: db_lesson.id },
    });

    return typedjson({ lesson: db_lesson, content: cms_lesson, progress });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw serverError("An error occurred while loading the course. Please try again.");
  }
}

const validator = withZod(
  z.object({
    userId: z.string().cuid(),
    lessonId: z.string().cuid(),
  }),
);

export async function action({ request }: ActionFunctionArgs) {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    throw validationError(result.error);
  }

  const { lessonId, userId } = result.data;

  const progress = await db.userLessonProgress.findFirst({
    where: { lessonId, userId },
    include: { lesson: { select: { requiredDurationInSeconds: true } } },
  });

  if (progress) {
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
      progress.lesson.requiredDurationInSeconds !== null &&
      progress.durationInSeconds + SUBMIT_INTERVAL_MS / 1_000 >= progress.lesson.requiredDurationInSeconds
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
    where: { lessonId, userId },
    create: {
      lessonId,
      userId,
      durationInSeconds: SUBMIT_INTERVAL_MS / 1_000,
    },
    update: { durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 } },
    include: { lesson: { select: { requiredDurationInSeconds: true } } },
  });

  if (!currentProgress.lesson.requiredDurationInSeconds) {
    return typedjson({ progress: currentProgress });
  }

  // Lessons with required durations
  if (
    currentProgress.lesson.requiredDurationInSeconds &&
    currentProgress.durationInSeconds >= currentProgress.lesson.requiredDurationInSeconds
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
  const user = useUser();
  const { lesson, content, progress } = useTypedLoaderData<typeof loader>();
  const video = content.data.attributes.video.data?.attributes;

  return (
    <div className="border-purple-800 max-w-screen-lg border p-6">
      <PageTitle>{content.data.attributes.title}</PageTitle>
      <ProgressTimer lesson={lesson} progress={progress} />
      {video ? (
        <MuxPlayer
          streamType="on-demand"
          title={video.title}
          playbackId={video.playback_id}
          accentColor="#FFD703"
          metadata={{
            video_id: video.asset_id,
            video_title: video.title,
            viewer_user_id: user.id,
          }}
        />
      ) : null}
      <article className="prose">
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
        {content.data.attributes.text_content ? (
          <BlocksRenderer content={content.data.attributes.text_content} />
        ) : null}
      </article>
      <pre className="text-xs">{JSON.stringify({ lesson, content }, null, 2)}</pre>
    </div>
  );
}
