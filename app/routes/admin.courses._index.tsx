import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { AdminButton } from "~/components/ui/admin-button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { getAllCourses } from "~/models/course.server";
import { SessionService } from "~/services/SessionService.server";

export const meta: MetaFunction = () => {
  return [{ title: `Courses | Plumb Media & Education}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);

  try {
    const dbCourses = await db.course.findMany({ include: { userCourses: true } });
    if (!dbCourses.length) {
      return typedjson({ courses: [] });
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
    return typedjson({ courses });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw toast.json(
      request,
      { message: "An error occurred while fetching courses." },
      { type: "error", title: "Error fetching courses", description: "An error occurred while fetching courses." },
    );
  }
}

export default function CoursesIndex() {
  const { courses } = useTypedLoaderData<typeof loader>();

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
            <AdminButton asChild variant="outline" className="ml-auto">
              <Link to={`/admin/courses/${course.id}`}>Edit</Link>
            </AdminButton>
          </CardFooter>
        </Card>
      ))}
    </ul>
  );
}
