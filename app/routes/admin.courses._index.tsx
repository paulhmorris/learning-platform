import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { AdminButton } from "~/components/ui/admin-button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/integrations/db.server";
import { getAllCourses } from "~/models/course.server";
import { SessionService } from "~/services/SessionService.server";

export const meta: MetaFunction = () => {
  return [{ title: `Courses | Plumb Media & Education}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);

  const dbCourses = await db.course.findMany({ include: { userCourses: true } });
  if (!dbCourses.length) {
    return json({ courses: [] });
  }

  const cmsCourses = await getAllCourses();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!cmsCourses) {
    throw new Error(`No courses found in CMS: ${JSON.stringify(cmsCourses)}`);
  }
  const courses = dbCourses.map((course) => {
    const cmsCourse = cmsCourses.find((c) => c.id === course.strapiId);
    return {
      ...course,
      title: cmsCourse?.attributes.title ?? "Unknown",
      description: cmsCourse?.attributes.description ?? "",
    };
  });
  return json({ courses });
}

export default function CoursesIndex() {
  const { courses } = useLoaderData<typeof loader>();

  return (
    <ul className="max-w-screen-sm">
      {courses.map((course) => (
        <Card key={course.id}>
          <CardHeader>
            <CardTitle>{course.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {course.userCourses.length} student{course.userCourses.length === 1 ? "" : "s"}
            </p>
            <CardDescription>{course.description}</CardDescription>
          </CardHeader>
          <CardFooter>
            <AdminButton asChild variant="default">
              <Link to={`/admin/courses/${course.id}/users`}>View Students</Link>
            </AdminButton>
            <AdminButton asChild variant="outline">
              <Link to={`/admin/courses/${course.id}/edit`}>Edit</Link>
            </AdminButton>
          </CardFooter>
        </Card>
      ))}
    </ul>
  );
}
