import { LoaderFunctionArgs, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { LessonContentRenderer } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { MarkCompleteButton } from "~/components/lesson/mark-complete-button";
import { useCourseData } from "~/hooks/useCourseData";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(args);

  const lessonSlug = args.params.lessonSlug;
  invariant(lessonSlug, "Lesson slug is required");

  const lesson = await LessonService.getBySlugWithContent(lessonSlug);
  const progress = await ProgressService.getByLessonId(userId, lesson.id);
  const isTimed = lesson.attributes.required_duration_in_seconds && lesson.attributes.required_duration_in_seconds > 0;
  return { lesson, progress, isTimed };
}

export default function Course() {
  const { course } = useCourseData();
  const { lesson, progress, isTimed } = useLoaderData<typeof loader>();

  return (
    <>
      <title>
        {lesson.attributes.title} | {course.attributes.title}
      </title>
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
