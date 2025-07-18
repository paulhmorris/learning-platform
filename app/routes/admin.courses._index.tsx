import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";

import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { AdminButton } from "~/components/ui/admin-button";
import { Badge } from "~/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/integrations/db.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);

  const dbCourses = await db.course.findMany({
    select: {
      id: true,
      strapiId: true,
      _count: { select: { userCourses: true } },
    },
  });
  if (!dbCourses.length) {
    return { courses: [] };
  }

  const cmsCourses = await CourseService.getAll();
  if (!cmsCourses.length) {
    throw new Error(`No courses found in CMS`);
  }
  const courses = dbCourses.map((course) => {
    const cmsCourse = cmsCourses.find((c) => c.id === course.strapiId);
    return {
      ...course,
      title: cmsCourse?.attributes.title ?? "Unknown",
      description: cmsCourse?.attributes.description ?? "",
    };
  });
  return { courses };
}

export default function CoursesIndex() {
  const { courses } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Courses | Plumb Media & Education</title>
      <PageTitle>Courses</PageTitle>
      <ul className="mt-8 max-w-screen-sm">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardHeader>
              <CardTitle>{course.title}</CardTitle>
              <Badge variant="default" className="self-start">
                {course._count.userCourses} student{course._count.userCourses === 1 ? "" : "s"}
              </Badge>
              <CardDescription className="line-clamp-4">{course.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <AdminButton asChild variant="default">
                <Link to={`${course.id}/users`} prefetch="intent">
                  View Students
                </Link>
              </AdminButton>
              <AdminButton asChild variant="outline">
                <Link to={`${course.id}/edit`} prefetch="intent">
                  Edit
                </Link>
              </AdminButton>
            </CardFooter>
          </Card>
        ))}
      </ul>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
