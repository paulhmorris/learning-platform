import { Link, Outlet, useParams } from "@remix-run/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTypedRouteLoaderData } from "remix-typedjson";

import { ProgressBar } from "~/components/common/progress-bar";
import { ErrorComponent } from "~/components/error-component";
import { IconClock } from "~/components/icons";
import { Section, SectionHeader } from "~/components/section";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { Separator } from "~/components/ui/separator";
import { loader as courseLoader } from "~/routes/_app.courses.$courseSlug";

export default function CourseLayout() {
  const data = useTypedRouteLoaderData<typeof courseLoader>("routes/_app.courses.$courseSlug");
  const params = useParams();

  if (!data) {
    throw new Error("Unable to fetch course data.");
  }

  const { course, progress, lessonsInOrder } = data;

  // Calculate the lesson last completed lesson, defaulting to the first lesson
  const nextLessonIndex = lessonsInOrder.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = nextLessonIndex === -1 ? 0 : nextLessonIndex - 1;

  // Sum the user progress to get the total progress
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);

  const totalDurationInSeconds = lessonsInOrder.reduce((acc, curr) => {
    return acc + (curr.requiredDurationInSeconds ?? 0);
  }, 0);

  return (
    <div>
      <nav className="fixed left-0 top-[88px] h-full shrink-0 basis-[448px] py-10 pl-4 md:py-12">
        <Link to={`/courses/${params.courseSlug}`} className="inline-flex items-center gap-2">
          <IconArrowLeft className="size-[1.125rem]" />
          <span>Back to course</span>
        </Link>

        {/* TODO: Adjust for non timed courses */}
        <div className="my-7 space-y-2">
          <ProgressBar id="course-progress" value={(totalProgressInSeconds / totalDurationInSeconds) * 100} />
          <label htmlFor="course-progress" className="flex items-center gap-2">
            <IconClock className="size-4" />
            {Math.ceil(totalProgressInSeconds / 60)} of {Math.ceil(totalDurationInSeconds / 60)} mins completed
          </label>
        </div>
        <div className="space-y-7">
          {course.attributes.sections.map((section) => {
            const durationInSeconds = section.lessons?.data.reduce(
              (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds || 0) + acc),
              0,
            );
            return (
              <Section key={`section-${section.id}`}>
                <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds || 1) / 60} />
                <Separator className="my-4" />
                <div className="flex flex-col gap-4">
                  {section.lessons?.data.map((l) => {
                    const lessonIndex = lessonsInOrder.findIndex((li) => li.uuid === l.attributes.uuid);
                    return (
                      <SectionLesson
                        key={l.attributes.uuid}
                        hasVideo={l.attributes.has_video}
                        userProgress={progress.find((lp) => lp.lessonId === l.id) ?? null}
                        courseSlug={params.courseSlug}
                        lesson={l}
                        lessonTitle={l.attributes.title}
                        locked={lessonIndex > lastCompletedLessonIndex + 1}
                      />
                    );
                  })}
                </div>
              </Section>
            );
          })}
        </div>
      </nav>
      <main className="ml-[448px] max-w-screen-md py-10 pr-4 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
