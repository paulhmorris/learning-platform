import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";

import { ErrorComponent } from "~/components/error-component";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseData } from "~/types/utils";

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

    const [content, firstLesson, courseProgress, lessonProgress] = await Promise.all([
      cms.findOne<APIResponseData<"api::course.course">>("courses", course.strapiId, {
        fields: ["title"],
        populate: {
          cover_image: {
            fields: ["alternativeText", "formats"],
          },
          sections: {
            fields: ["title", "uuid"],
            populate: {
              quiz: {
                fields: ["title", "uuid"],
              },
              lessons: {
                fields: ["title", "slug", "has_video", "uuid"],
              },
            },
          },
        },
      }),
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
    return typedjson({ course, content, firstLesson, courseProgress, lessonProgress });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw serverError("An error occurred while loading the course. Please try again.");
  }
}

export default function CourseLayout() {
  return (
    <div className="relative">
      <main className="ml-[400px] py-10 pl-12 pr-4 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
