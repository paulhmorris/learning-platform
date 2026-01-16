import { useMemo } from "react";
import { LoaderFunctionArgs, ShouldRevalidateFunction, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { LessonContentRenderer } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { MarkCompleteButton } from "~/components/lesson/mark-complete-button";
import { useCourseData } from "~/hooks/useCourseData";
import { useProgress } from "~/hooks/useProgress";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { HttpHeaders, Responses } from "~/lib/responses.server";
import { LessonService } from "~/services/lesson.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Routes.LessonIndex");

export const shouldRevalidate: ShouldRevalidateFunction = ({ formAction, defaultShouldRevalidate }) => {
  if (formAction?.includes("/api/progress")) {
    return false;
  }
  return defaultShouldRevalidate;
};

export function headers() {
  return {
    [HttpHeaders.CacheControl]: "public, s-maxage=300, max-age=300, stale-while-revalidate=86400",
  };
}

export async function loader(args: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(args);

  try {
    const lessonSlug = args.params.lessonSlug;
    invariant(lessonSlug, "Lesson slug is required");

    const lesson = await LessonService.getBySlugWithContent(lessonSlug);
    return { lesson, userId };
  } catch (error) {
    logger.error(`Error loading lesson data for slug ${args.params.lessonSlug}`, { error });
    Sentry.captureException(error, { extra: { lessonSlug: args.params.lessonSlug, userId } });
    throw Responses.serverError();
  }
}

export default function Course() {
  const { lessonProgress } = useProgress();
  const { course } = useCourseData();
  const { lesson, userId } = useLoaderData<typeof loader>();

  const progress = useMemo(() => {
    return lessonProgress.find((p) => p.lessonId === lesson.id) ?? null;
  }, [lesson.id, lessonProgress]);

  const isTimed = Boolean(lesson.attributes.required_duration_in_seconds);

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
        <LessonContentRenderer content={lesson.attributes.content} viewerUserId={userId} />
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
