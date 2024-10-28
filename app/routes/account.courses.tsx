import { MetaFunction, useLoaderData } from "@remix-run/react";
import { LoaderFunctionArgs, json } from "@vercel/remix";
import dayjs from "dayjs";

import { ErrorComponent } from "~/components/error-component";
import { IconCertificate } from "~/components/icons";
import { AdminButton } from "~/components/ui/admin-button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { db } from "~/integrations/db.server";
import { serverError } from "~/lib/responses.server";
import { loader as rootLoader } from "~/root";
import { CourseService } from "~/services/course.server";
import { SessionService } from "~/services/session.server";

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Profile | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const [userCourses, cmsCourses] = await Promise.all([
    db.userCourses.findMany({ where: { userId }, include: { course: true } }),
    CourseService.getAll(),
  ]);

  if (!cmsCourses.length) {
    throw serverError("Failed to fetch courses");
  }

  const courses = userCourses.map((dbCourse) => {
    const cmsCourse = cmsCourses.find((course) => course.id === dbCourse.course.strapiId);
    return {
      ...dbCourse,
      title: cmsCourse?.attributes.title,
      description: cmsCourse?.attributes.description,
    };
  });

  return json({ courses, userCourses });
}

export default function AccountCourses() {
  const { courses, userCourses } = useLoaderData<typeof loader>();

  return (
    <>
      <h1 className="sr-only">Courses</h1>
      <p className="text-base">
        {courses.length > 0
          ? "You are enrolled in the following courses"
          : "You are not currently enrolled in any courses"}
      </p>
      <ul className="mt-4">
        {courses.map((course) => {
          const userCourse = userCourses.find((uc) => uc.course.strapiId === course.id);

          return (
            <li key={course.id}>
              <Card>
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription>{course.description}</CardDescription>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <p className="text-xs">{course.isCompleted ? "Complete" : "Incomplete"}</p>
                    <span className="text-xs">•</span>
                    <p className="text-xs">Purchased {dayjs(course.createdAt).format("M/D/YY")}</p>
                  </div>
                </CardHeader>
                <CardFooter>
                  <AdminButton asChild>
                    <a
                      href={new URL("/preview", `https://${course.course.host}`).toString()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Go to Course
                    </a>
                  </AdminButton>
                  {userCourse?.certificateClaimed && userCourse.certificateS3Key ? (
                    <AdminButton variant="outline" asChild>
                      <a
                        className="flex items-center gap-1.5"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://assets.hiphopdriving.com/${userCourse.certificateS3Key}`}
                      >
                        <IconCertificate className="size-4 shrink-0" />
                        <span>View Certificate</span>
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
