import { Link, MetaFunction, useLoaderData } from "@remix-run/react";
import { LoaderFunctionArgs, json } from "@vercel/remix";

import { ErrorComponent } from "~/components/error-component";
import { IconCertificate } from "~/components/icons";
import { AdminButton } from "~/components/ui/admin-button";
import { Button } from "~/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/integrations/db.server";
import { notFound } from "~/lib/responses.server";
import { getAllCourses } from "~/models/course.server";
import { SessionService } from "~/services/session.server";

export const meta: MetaFunction = () => {
  return [{ title: `User Courses | Plumb Media & Education` }];
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);

  const userId = params.id;
  if (!userId) {
    throw notFound("User not found.");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      courses: {
        include: {
          course: true,
        },
      },
    },
  });
  const cmsCourses = await getAllCourses();

  if (!cmsCourses.length) {
    throw new Response("Failed to fetch courses", { status: 500 });
  }

  const courses = user.courses.map((dbCourse) => {
    const cmsCourse = cmsCourses.find((course) => course.id === dbCourse.course.strapiId);
    return {
      ...dbCourse,
      title: cmsCourse?.attributes.title,
      description: cmsCourse?.attributes.description,
    };
  });

  return json({ user, courses });
}

export default function AdminUserCourses() {
  const { user, courses } = useLoaderData<typeof loader>();
  return (
    <>
      <h1 className="sr-only">Courses</h1>
      <p className="text-base">
        {courses.length > 0
          ? `${user.firstName} is enrolled in the following courses`
          : `${user.firstName} is not currently enrolled in any courses`}
      </p>
      <ul className="mt-4">
        {courses.map((course) => {
          return (
            <li key={course.id}>
              <Card className="inline-block">
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.isCompleted ? "Complete" : "In Progress"} • Purchased{" "}
                    {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardFooter>
                  <Button variant="admin" asChild className="w-auto">
                    <Link to={`/admin/users/${user.id}/courses/${course.id}`}>View Progress</Link>
                  </Button>
                  {/* certificate */}
                  {course.certificateClaimed ? (
                    <AdminButton variant="outline" asChild className="w-auto">
                      <a
                        href={`https://assets.hiphopdriving.com/${course.certificateS3Key}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2"
                      >
                        <IconCertificate className="size-4" />
                        <span>Download Certificate</span>
                      </a>
                    </AdminButton>
                  ) : null}
                </CardFooter>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
