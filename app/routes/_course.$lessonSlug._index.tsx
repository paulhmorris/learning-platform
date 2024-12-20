import { MetaFunction, useLoaderData } from "@remix-run/react";
import { json, LoaderFunctionArgs } from "@vercel/remix";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { LessonContentRenderer, StrapiContent } from "~/components/lesson/lesson-content-renderer";
import { LessonProgressBar } from "~/components/lesson/lesson-progress-bar";
import { MarkCompleteButton } from "~/components/lesson/mark-complete-button";
import { loader as courseLoader } from "~/routes/_course";
import { LessonService } from "~/services/lesson.server";
import { ProgressService } from "~/services/progress.server";
import { SessionService } from "~/services/session.server";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const lessonSlug = params.lessonSlug;
  invariant(lessonSlug, "Lesson slug is required");

  const lesson = await LessonService.getBySlugWithContent(lessonSlug);
  const progress = await ProgressService.getByLessonId(userId, lesson.id);
  const isTimed = lesson.attributes.required_duration_in_seconds && lesson.attributes.required_duration_in_seconds > 0;
  return json({ lesson, progress, isTimed });
}

export const meta: MetaFunction<typeof loader, { "routes/_course": typeof courseLoader }> = ({ data, matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "routes/_course")?.data.course;
  return [{ title: `${data?.lesson.attributes.title} | ${match?.attributes.title}` }];
};

export default function Course() {
  const { lesson, progress, isTimed } = useLoaderData<typeof loader>();

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
