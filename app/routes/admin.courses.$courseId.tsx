import { Outlet, useLoaderData } from "@remix-run/react";
import { LoaderFunctionArgs, json } from "@vercel/remix";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { db } from "~/integrations/db.server";
import { getCoursefromCMSForRoot } from "~/models/course.server";
import { SessionService } from "~/services/session.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.courseId;

  const dbCourse = await db.course.findUniqueOrThrow({ where: { id }, include: { userCourses: true } });
  const cmsCourse = await getCoursefromCMSForRoot(dbCourse.strapiId);
  if (!cmsCourse) {
    throw new Error("No course found in CMS.");
  }
  const course = {
    ...dbCourse,
    title: cmsCourse.data.attributes.title,
    description: cmsCourse.data.attributes.description ?? "",
  };
  return json({ course });
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
