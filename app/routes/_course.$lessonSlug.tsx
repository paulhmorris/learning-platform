import { useMemo } from "react";
import { LoaderFunctionArgs, ShouldRevalidateFunction, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { LessonContentRenderer } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { MarkCompleteButton } from "~/components/lesson/mark-complete-button";
import { useCourseData } from "~/hooks/useCourseData";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { LessonService } from "~/services/lesson.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Routes.LessonIndex");

export const shouldRevalidate: ShouldRevalidateFunction = ({ formAction, defaultShouldRevalidate }) => {
  if (formAction?.includes("/api/lesson-progress")) {
    return false;
  }
  return defaultShouldRevalidate;
};

export async function loader(args: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(args);

  try {
    const lessonSlug = args.params.lessonSlug;
    invariant(lessonSlug, "Lesson slug is required");

    const lesson = await LessonService.getBySlugWithContent(lessonSlug);
    const isTimed = Boolean(lesson.attributes.required_duration_in_seconds);
    return { lesson, isTimed };
  } catch (error) {
    logger.error("Error loading lesson data", { error, lessonSlug: args.params.lessonSlug });
    Sentry.captureException(error, { extra: { lessonSlug: args.params.lessonSlug, userId } });
    throw Responses.serverError();
  }
}

export default function Course() {
  const { course, lessonProgress } = useCourseData();
  const { lesson, isTimed } = useLoaderData<typeof loader>();

  const progress = useMemo(() => {
    return lessonProgress.find((p) => p.lessonId === lesson.id) ?? null;
  }, [lesson.id, lessonProgress]);

  return (
    <>
      <title>{`${lesson.attributes.title} | ${course.attributes.title}`}</title>
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
