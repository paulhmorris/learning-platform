import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useMemo } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";

import { ProgressBar } from "~/components/common/progress-bar";
import { CourseHeader } from "~/components/course/course-header";
import { CourseUpNext } from "~/components/course/course-up-next";
import { ErrorComponent } from "~/components/error-component";
import { Course, cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";
import { TypedMetaFunction } from "~/lib/types";
import { generateImgSizes, generateImgSrcSet } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  try {
    const course = await db.course.findUniqueOrThrow({
      where: { slug: courseSlug },
      include: {
        lessons: {
          select: {
            requiredDurationInSeconds: true,
          },
        },
      },
    });
    const content = await cms.findOne<Course>("courses", course.strapiId, {
      fields: ["title"],
      populate: {
        cover_image: {
          fields: ["alternativeText", "formats"],
        },
        lessons: {
          fields: ["title", "slug"],
          populate: ["video"],
        },
      },
    });

    const [firstLesson, courseProgress, lessonProgress] = await Promise.all([
      db.lesson.findFirst(),
      db.userCourseProgress.findUnique({
        where: {
          courseId: course.id,
          userId: user.id,
        },
        select: {
          durationInSeconds: true,
        },
      }),
      db.userLessonProgress.findMany({
        where: {
          userId: user.id,
          lesson: {
            courseId: course.id,
          },
        },
        select: {
          isCompleted: true,
          durationInSeconds: true,
        },
      }),
    ]);

    // Generate srcset and sizes for the cover image server-side
    const formats = content.data.attributes.cover_image?.data.attributes.formats;
    const imgSrcSet = formats ? generateImgSrcSet(formats) : undefined;
    const imgSizes = formats ? generateImgSizes(formats) : undefined;

    // return json({ course, content, firstLesson, progress, imgSrcSet, imgSizes });
    return typedjson({ course, content, firstLesson, courseProgress, lessonProgress, imgSrcSet, imgSizes });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw serverError("An error occurred while loading the course. Please try again.");
  }
}

export const meta: TypedMetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `Course Overview | ${data?.content.data.attributes.title}` }];
};

export default function CourseIndex() {
  const { course, content, firstLesson, courseProgress, lessonProgress } = useTypedLoaderData<typeof loader>();
  const nextLesson = content.data.attributes.lessons?.data[0].attributes;
  const totalDurationInSeconds = useMemo(() => {
    return course.lessons.reduce((acc, lesson) => acc + (lesson.requiredDurationInSeconds || 0), 0);
  }, [course]);

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
