import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { IconCertificate } from "~/components/icons";
import { AdminButton } from "~/components/ui/admin-button";
import { Button } from "~/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/db.server";
import { notFound, serverError } from "~/lib/responses.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);

  const userId = args.params.id;
  if (!userId) {
    throw notFound("User not found.");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      courses: {
        include: {
          course: true,
        },
      },
    },
  });

  if (!user?.clerkId) {
    throw notFound({ message: "User not found." });
  }

  const backendUser = await clerkClient.users.getUser(user.clerkId);

  const cmsCourses = await CourseService.getAll();

  if (!cmsCourses.length) {
    throw serverError("Failed to fetch courses");
  }

  const courses = user.courses.map((dbCourse) => {
    const cmsCourse = cmsCourses.find((course) => course.id === dbCourse.course.strapiId);
    return {
      ...dbCourse,
      title: cmsCourse?.attributes.title,
      description: cmsCourse?.attributes.description,
    };
  });

  return {
    courses,
    user: {
      ...user,
      firstName: backendUser.firstName,
      lastName: backendUser.lastName,
    },
  };
}

export default function AdminUserCourses() {
  const { user, courses } = useLoaderData<typeof loader>();
  return (
    <>
      <title>User Courses | Plumb Media & Education</title>
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
