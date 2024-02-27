import { Link, Outlet, useParams } from "@remix-run/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useTypedRouteLoaderData } from "remix-typedjson";

import { ProgressBar } from "~/components/common/progress-bar";
import { ErrorComponent } from "~/components/error-component";
import { Section, SectionHeader } from "~/components/section";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { Separator } from "~/components/ui/separator";
import { loader as courseLoader } from "~/routes/_app.courses.$courseSlug";

export default function CourseLayout() {
  const data = useTypedRouteLoaderData<typeof courseLoader>("routes/_app.courses.$courseSlug");
  const params = useParams();

  if (!data) {
    throw new Error("No course data");
  }

  const { course, progress } = data;

  // sum up all the progresses to get the total progress
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);

  return (
    <div className="flex gap-x-12">
      <nav className="sticky left-0 top-[88px] h-full shrink-0 basis-[448px] py-10 pl-4 md:py-12">
        <Link to={`/courses/${params.courseSlug}`} className="flex items-center gap-2">
          <IconArrowLeft className="size-[1.125rem]" />
          <span>Back to course</span>
        </Link>

        {/* TODO: Adjust for non timed courses */}
        <div className="my-7">
          <ProgressBar id="course-progress" value={(totalProgressInSeconds / 21_600) * 100} />
          <label htmlFor="course-progress">2 of 5 minutes completed</label>
        </div>
        <div className="space-y-7">
          {course.attributes.sections.map((section) => {
            const lessons = section.lessons
              ? section.lessons.data.sort((a, b) => a.attributes.order - b.attributes.order)
              : [];
            const durationInSeconds = lessons.reduce(
              (acc, curr) => Math.ceil((curr.attributes.required_duration_in_seconds || 0) + acc),
              0,
            );
            return (
              <Section key={`section-${section.id}`}>
                <SectionHeader sectionTitle={section.title} durationInMinutes={(durationInSeconds || 1) / 60} />
                <Separator className="my-4" />
                <div className="flex flex-col gap-4">
                  {lessons.map((l) => {
                    return (
                      <SectionLesson
                        key={l.attributes.uuid}
                        hasVideo={l.attributes.has_video}
                        userProgress={progress.find((lp) => lp.lessonId === l.id) ?? null}
                        courseSlug={params.courseSlug}
                        lesson={l}
                        lessonTitle={l.attributes.title}
                      />
                    );
                  })}
                </div>
              </Section>
            );
          })}
        </div>
      </nav>
      <main className="max-w-screen-md py-10 pr-4 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
