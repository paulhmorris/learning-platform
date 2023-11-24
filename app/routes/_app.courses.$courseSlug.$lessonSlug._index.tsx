import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";
import { z } from "zod";

import { ProgressTimer } from "~/components/lesson/ProgressTimer";
import { getEntry } from "~/integrations/strapi.server.";
import { prisma } from "~/lib/db.server";
import { badRequest, notFound } from "~/lib/responses.server";
import { requireUserId } from "~/lib/session.server";
import { parseForm } from "~/lib/utils";

export const SUBMIT_INTERVAL_MS = 10_000;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  const courseSlug = params.courseSlug;
  const lessonSlug = params.lessonSlug;
  invariant(courseSlug, "Course slug is required");
  invariant(lessonSlug, "Lesson slug is required");

  const lesson = await prisma.lesson.findUnique({
    where: {
      slug: lessonSlug,
      course: { slug: courseSlug },
    },
  });
  if (!lesson) {
    throw notFound({ message: "Lesson not found" });
  }

  const content = await getEntry("lessons", lesson.strapiId);
  if (!content) {
    throw notFound({ message: "Lesson content not found" });
  }

  const progress = await prisma.userLessonProgress.findUnique({
    where: { userId, lessonId: lesson.id },
  });

  return typedjson({ lesson, content, progress });
}

const ProgressUpdateShema = z.object({
  userId: z.string().cuid(),
  lessonId: z.string().cuid(),
});

export async function action({ request }: ActionFunctionArgs) {
  const {
    value: { lessonId, userId },
  } = await parseForm({ request, schema: ProgressUpdateShema });

  // Prevent spamming the endpoint
  const progress = await prisma.userLessonProgress.findFirst({ where: { lessonId, userId } });
  if (progress) {
    const now = new Date().getTime();
    const lastUpdate = progress.updatedAt.getTime();

    if (now - lastUpdate < SUBMIT_INTERVAL_MS) {
      throw badRequest({ message: "Too many requests" });
    }
  }

  const currentProgress = await prisma.userLessonProgress.upsert({
    where: { lessonId, userId },
    create: {
      lessonId,
      userId,
      durationInSeconds: SUBMIT_INTERVAL_MS / 1_000,
    },
    update: {
      durationInSeconds: { increment: SUBMIT_INTERVAL_MS / 1_000 },
    },
    include: { lesson: { select: { requiredDurationInSeconds: true } } },
  });

  if (!currentProgress?.lesson.requiredDurationInSeconds) {
    return typedjson({ progress: currentProgress });
  }

  // Lessons with required durations
  if (currentProgress.lesson.requiredDurationInSeconds && currentProgress.durationInSeconds >= currentProgress.lesson.requiredDurationInSeconds) {
    const progress = await prisma.userLessonProgress.update({
      where: { id: currentProgress.id },
      data: { isCompleted: true },
    });
    return typedjson({ progress });
  }

  return typedjson({ progress: currentProgress });
}

export default function Course() {
  const { lesson, content, progress } = useTypedLoaderData<typeof loader>();

  return (
    <div className="border border-purple-800 p-6">
      <h1>{content.data.attributes.title}</h1>
      {lesson.requiredDurationInSeconds ? <ProgressTimer lesson={lesson} progress={progress} /> : null}
      <pre className="text-sm">{JSON.stringify({ content, lesson, progress }, null, 2)}</pre>
    </div>
  );
}
