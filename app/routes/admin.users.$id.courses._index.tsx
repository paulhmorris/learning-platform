import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { IconCertificate } from "~/components/icons";
import { AdminButton } from "~/components/ui/admin-button";
import { Button } from "~/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { useAdminUserData } from "~/hooks/useAdminUserData";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Responses } from "~/lib/responses.server";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("Routes.AdminUserCourses");

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);

  const id = args.params.id;
  if (!id) {
    logger.error("User ID not found");
    throw Responses.notFound();
  }

  try {
    const [user, cmsCourses] = await Promise.all([UserService.getByIdWithCourse(id), CourseService.getAll()]);

    if (!user || !cmsCourses.length) {
      logger.error("User or courses not found", { user, cmsCourses });
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
  } catch (error) {
    Sentry.captureException(error);
    logger.error("Failed to load user courses", { error, userId: id });
    throw Responses.serverError();
  }
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
                  {course.certificate ? (
                    <AdminButton variant="outline" asChild className="w-auto">
                      <a
                        href={`https://assets.hiphopdriving.com/${course.certificate.s3Key}`}
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
