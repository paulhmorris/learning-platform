import { NavLink, useParams } from "@remix-run/react";
import { useTypedRouteLoaderData } from "remix-typedjson";

import { ProgressBar } from "~/components/common/progress-bar";
import { StrapiImage } from "~/components/common/strapi-image";
import { CourseHeader } from "~/components/course/course-header";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { IconClipboard, IconDocument } from "~/components/icons";
import { Section, SectionHeader } from "~/components/section";
import { SectionLesson } from "~/components/sidebar/section-lesson";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { loader } from "~/routes/_app.courses.$courseSlug";
import { TypedMetaFunction } from "~/types/utils";

export const meta: TypedMetaFunction<typeof loader, { "routes/_app.courses.$courseSlug": typeof loader }> = ({
  matches,
}) => {
  // @ts-expect-error typed meta funtion not supporting this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "routes/_app.courses.$courseSlug")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Course Overview | ${match?.attributes.title}` }];
};

export default function CourseIndex() {
  const data = useTypedRouteLoaderData<typeof loader>("routes/_app.courses.$courseSlug");
  const params = useParams();

  // useEffect(() => {
  //   console.log(data);
  // }, []);

  if (!data) {
    throw new Error("No course data");
  }

  const { course, progress, lessonsInOrder } = data;

  // Calculate the most recent lesson that is in progress, defaulting to the first lesson
  // Calculate the lesson last completed lesson, defaulting to the first lesson
  const nextLessonIndex = lessonsInOrder.findIndex((l) => !l.isCompleted);
  const lastCompletedLessonIndex = nextLessonIndex === -1 ? 0 : nextLessonIndex - 1;
  const upNext = lessonsInOrder.at(nextLessonIndex);

  // Sum the user progress to get the total progress
  const totalProgressInSeconds = progress.reduce((acc, curr) => {
    return acc + (curr.durationInSeconds ?? 0);
  }, 0);

  const totalDurationInSeconds = lessonsInOrder.reduce((acc, curr) => {
    return acc + (curr.requiredDurationInSeconds ?? 0);
  }, 0);

  // useEffect(() => {
  //   console.log({
  //     lessonsInOrder,
  //   });
  // }, []);

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
          {upNext ? <CourseUpNext lesson={lessonsInOrder[lastCompletedLessonIndex + 1]} /> : null}
        </div>

        <div className="mt-10 space-y-7">
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
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
