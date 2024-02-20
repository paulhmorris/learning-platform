import { useTypedRouteLoaderData } from "remix-typedjson";

import { ProgressBar } from "~/components/common/progress-bar";
import { CourseHeader } from "~/components/course/course-header";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { loader } from "~/routes/_app.courses.$courseSlug";
import { TypedMetaFunction } from "~/types/utils";

export const meta: TypedMetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Course Overview | ${data?.content.data.attributes.title}` }];
};

export default function CourseIndex() {
  const data = useTypedRouteLoaderData<typeof loader>("routes/_app.courses.$courseSlug");
  if (!data) {
    return null;
  }

  const { course, content, firstLesson, courseProgress, lessonProgress } = data;
  const nextLesson = content.data.attributes.lessons?.data[0].attributes;
  const totalDurationInSeconds = course.lessons.reduce(
    (acc, lesson) => acc + (lesson.requiredDurationInSeconds || 0),
    0,
  );

  // Timed Courses
  if (courseProgress && courseProgress.durationInSeconds && totalDurationInSeconds > 0) {
    return (
      <div>
        <div className="space-y-8">
          <CourseHeader courseTitle={content.data.attributes.title} numLessons={course.lessons.length} />
          <div className="space-y-2">
            <ProgressBar
              aria-label="Course progress"
              id="course-progress"
              value={(courseProgress.durationInSeconds / totalDurationInSeconds) * 100}
            />
            <label htmlFor="course-progress">
              {Math.floor(courseProgress.durationInSeconds / 60)} of {totalDurationInSeconds / 60} minutes completed
            </label>
          </div>
          {nextLesson ? <CourseUpNext content={nextLesson} lesson={firstLesson!} /> : null}
        </div>
      </div>
    );
  }

  // Untimed Courses
  const completedLessons = lessonProgress.filter((lesson) => lesson.isCompleted).length;
  return (
    <div>
      <div className="space-y-8">
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
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}

{
  /* <img
  height={480}
  width={700}
  fetchpriority="high"
  loading="eager"
  srcSet={imgSrcSet}
  sizes={imgSizes}
  alt={content.data.attributes.cover_image?.data.attributes.alternativeText}
/> */
}
