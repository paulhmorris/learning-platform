import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";

import { ErrorComponent } from "~/components/error-component";
import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, notFound, serverError } from "~/lib/responses.server";
import { SessionService } from "~/services/SessionService.server";
import { APIResponseCollection } from "~/types/utils";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  try {
    const courseResult = await cms.find<APIResponseCollection<"api::course.course">["data"]>("courses", {
      filters: {
        slug: courseSlug,
      },
      fields: ["title"],
      populate: {
        cover_image: {
          fields: ["alternativeText", "formats", "url"],
        },
        lessons: {
          fields: ["title", "slug", "has_video", "uuid", "required_duration_in_seconds"],
        },
        sections: {
          fields: ["title"],
          populate: {
            quiz: {
              fields: ["title", "uuid"],
            },
            lessons: {
              fields: ["title", "slug", "has_video", "uuid", "required_duration_in_seconds"],
            },
          },
        },
      },
    });

    if (courseResult.data.length > 1) {
      throw serverError("Multiple courses with the same slug found.");
    }

    if (courseResult.data.length === 0) {
      throw notFound("Course not found.");
    }

    const course = courseResult.data[0];

    const progress = await db.userLessonProgress.findMany({ where: { userId: user.id } });
    const lessonsInOrder = course.attributes.sections.flatMap((section) => {
      return (
        section.lessons?.data.map((l) => {
          const lessonProgress = progress.find((p) => p.lessonId === l.id);
          return {
            uuid: l.attributes.uuid,
            sectionId: section.id,
            sectionTitle: section.title,
            isCompleted: lessonProgress?.isCompleted ?? false,
            isTimed: l.attributes.required_duration_in_seconds && l.attributes.required_duration_in_seconds > 0,
            requiredDurationInSeconds: l.attributes.required_duration_in_seconds,
            progressDuration: lessonProgress?.durationInSeconds,
          };
        }) ?? []
      );
    });

    console.log(lessonsInOrder);

    return typedjson({ course, progress, lessonsInOrder });
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
  return <Outlet />;
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
