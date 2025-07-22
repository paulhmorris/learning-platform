import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { IconCertificate } from "~/components/icons";
import { AdminButton } from "~/components/ui/admin-button";
import { Button } from "~/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useAdminUserData } from "~/hooks/useAdminUserData";
import { db } from "~/integrations/db.server";
import { Responses } from "~/lib/responses.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);

  const clerkId = args.params.id;
  if (!clerkId) {
    throw Responses.notFound();
  }

  const [user, cmsCourses] = await Promise.all([
    db.user.findUnique({
      where: { clerkId },
      select: {
        courses: {
          select: {
            id: true,
            isCompleted: true,
            completedAt: true,
            certificateClaimed: true,
            certificateS3Key: true,
            createdAt: true,
            course: {
              select: {
                id: true,
                strapiId: true,
              },
            },
          },
        },
      },
    }),
    CourseService.getAll(),
  ]);

  if (!user || !cmsCourses.length) {
    throw Responses.notFound();
  }

  const courses = user.courses.map((dbCourse) => {
    const cmsCourse = cmsCourses.find((course) => course.id === dbCourse.course.strapiId);
    return {
      ...dbCourse,
      title: cmsCourse?.attributes.title,
      description: cmsCourse?.attributes.description,
    };
  });

  return { courses };
}

export default function AdminUserCourses() {
  const { user: layoutUser } = useAdminUserData();
  const { courses } = useLoaderData<typeof loader>();

  return (
    <>
      <title>User Courses | Plumb Media & Education</title>
      <h1 className="sr-only">Courses</h1>
      {courses.length === 0 ? (
        <p className="text-base">{layoutUser.firstName} is not currently enrolled in any courses</p>
      ) : null}
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
                    <Link to={`${course.id}`}>View Progress</Link>
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
