import { LoaderFunctionArgs, Outlet, useLoaderData } from "react-router";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireAdmin(args);
  const id = args.params.courseId;

  const dbCourse = await db.course.findUnique({ where: { id }, include: { userCourses: true } });
  if (!dbCourse) {
    Sentry.captureMessage(`Course ${id} not found`, { level: "error", extra: { userId: user.id, courseId: id } });
    throw Responses.notFound();
  }
  const cmsCourse = await CourseService.getFromCMSForRoot(dbCourse.strapiId);
  if (!cmsCourse) {
    throw new Error("No course found in CMS.");
  }
  const course = {
    ...dbCourse,
    title: cmsCourse.data.attributes.title,
    description: cmsCourse.data.attributes.description ?? "",
  };
  return { course };
}

export default function AdminEditCourse() {
  const { course } = useLoaderData<typeof loader>();

  return (
    <>
      <BackLink to="/admin/courses">Back to courses</BackLink>
      <h1 className="mt-4 text-3xl">{course.title}</h1>
      <div className="mt-2">
        <Outlet />
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
