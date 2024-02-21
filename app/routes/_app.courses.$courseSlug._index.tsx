import { NavLink, useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useTypedRouteLoaderData } from "remix-typedjson";

import { ProgressBar } from "~/components/common/progress-bar";
import { StrapiImage } from "~/components/common/strapi-image";
import { CourseHeader } from "~/components/course/course-header";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { IconClipboard, IconDocument } from "~/components/icons";
import { cn } from "~/lib/utils";
import { loader } from "~/routes/_app.courses.$courseSlug";
import { TypedMetaFunction } from "~/types/utils";

export const meta: TypedMetaFunction<typeof loader> = ({ matches }) => {
  const match = matches.find((m) => m.id === "routes/_app.courses.$courseSlug")?.data.course;
  return [{ title: `Course Overview | ${match?.attributes.title}` }];
};

export default function CourseIndex() {
  const data = useTypedRouteLoaderData<typeof loader>("routes/_app.courses.$courseSlug");
  const params = useParams();

  useEffect(() => {
    console.log(data);
  }, []);

  if (!data) {
    throw new Error("No course data");
  }

  const { course, progress } = data;
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);
  const totalDurationInSeconds =
    course.attributes.lessons?.data.reduce((acc, curr) => {
      return acc + (curr.attributes.required_duration_in_seconds ?? 0);
    }, 0) ?? 1;

  const upNext = course.attributes.lessons?.data
    .sort((a, b) => a.attributes.order - b.attributes.order)
    .find((l) => progress.every((p) => p.lessonId !== l.id));

  // Timed Courses
  return (
    <div className="flex gap-x-12 px-10">
      <nav className="sticky left-0 top-[88px] h-full shrink-0 basis-[448px] py-10 md:py-14">
        <StrapiImage
          asset={course.attributes.cover_image}
          height={240}
          width={400}
          fetchpriority="high"
          loading="eager"
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          alt={course.attributes.cover_image?.data?.attributes.alternativeText}
          className="overflow-hidden rounded-xl object-cover shadow-[0px_8px_32px_0px_#00000029]"
        />
        <div className="mt-7">
          <NavLink
            to={`/courses/${params.courseSlug}`}
            className={({ isActive }) =>
              cn(
                isActive ? "border-l-4 border-primary underline" : "",
                "flex items-center gap-2 border-b border-b-gray-200 px-4 py-7 text-lg font-medium",
              )
            }
          >
            {({ isActive }) => (
              <>
                <IconClipboard className={cn(isActive ? "text-primary" : "text-foreground")} />
                <span>Course Chapters</span>
              </>
            )}
          </NavLink>
          <NavLink
            to={`/courses/${params.courseSlug}/certificate`}
            className={({ isActive }) =>
              cn(
                isActive ? "border-l-4 border-primary underline" : "",
                "flex items-center gap-2 border-b border-b-gray-200 px-4 py-7 text-lg font-medium",
              )
            }
          >
            {({ isActive }) => (
              <>
                <IconDocument className={cn(isActive ? "text-primary" : "text-foreground")} />
                <span>Certificate</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
      <main className="max-w-screen-md py-10 md:py-14">
        <div className="space-y-8">
          <CourseHeader
            courseTitle={course.attributes.title}
            numLessons={course.attributes.lessons?.data.length ?? 0}
          />
          <div className="space-y-2">
            <ProgressBar aria-label="Course progress" id="course-progress" value={50} />
            <label htmlFor="course-progress">
              {Math.floor(totalProgressInSeconds / 60)} of {totalDurationInSeconds / 60} minutes completed
            </label>
          </div>
          <CourseUpNext lesson={upNext} />
        </div>

        {/* <div className="space-y-8">
              <CourseHeader courseTitle={content.data.attributes.title} numLessons={course.lessons.length} />
              <div className="space-y-2">
                <ProgressBar
                  aria-label="Course progress"
                  id="course-progress"
                  value={(completedLessons / course.lessons.length) * 100}
                />
                <label htmlFor="course-progress">
                  {Math.floor(completedLessons)} of {course.lessons.length}{" "}
                  {course.lessons.length === 1 ? "lesson" : "lessons"} completed
                </label>
              </div>
              {nextLesson ? <CourseUpNext content={nextLesson} lesson={firstLesson!} /> : null}
            </div>
          </div> */}
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}

{
  /* */
}
