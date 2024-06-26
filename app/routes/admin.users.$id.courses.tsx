import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, MetaFunction } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { ErrorComponent } from "~/components/error-component";
import { Button } from "~/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/integrations/db.server";
import { notFound } from "~/lib/responses.server";
import { getAllCourses } from "~/models/course.server";
import { SessionService } from "~/services/SessionService.server";

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

  return typedjson({ user, courses });
}

export default function AdminUserCourses() {
  const { user, courses } = useTypedLoaderData<typeof loader>();
  return (
    <>
      <h1 className="sr-only">Courses</h1>
      <p className="text-base">
        {courses.length > 0
          ? `${user.firstName} is enrolled in the following courses`
          : `${user.firstName} is not currently enrolled in any courses`}
      </p>
      <ul className="mt-4">
        {courses.map((course) => (
          <li key={course.id}>
            <Card className="inline-block">
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
              </CardHeader>
              <CardFooter>
                <Button variant="admin" asChild className="w-auto">
                  <Link to={`/admin/users/${user.id}/courses/${course.id}`}>Adjust Progress</Link>
                </Button>
              </CardFooter>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
