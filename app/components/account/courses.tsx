import { IconCertificate } from "@tabler/icons-react";
import dayjs from "dayjs";

import { AdminButton } from "~/components/ui/admin-button";
import { Badge } from "~/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { loader } from "~/routes/account.$";

type Props = {
  courses: Awaited<ReturnType<typeof loader>>["courses"];
  userCourses: Awaited<ReturnType<typeof loader>>["userCourses"];
};

export function AccountCourses(props: Props) {
  const { courses, userCourses } = props;

  return (
    <>
      <h1 className="sr-only">Courses</h1>
      <p className="text-sm">
        {courses.length > 0
          ? "You are enrolled in the following courses"
          : "You are not currently enrolled in any courses"}
      </p>
      <ul className="mt-4">
        {courses.map((course) => {
          const userCourse = userCourses.find((uc) => uc.course.strapiId === course.id);

          return (
            <li key={course.createdAt.getTime()}>
              <Card>
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Badge variant={course.isCompleted ? "success" : "outline"}>
                      {course.isCompleted ? "Complete" : "Incomplete"}
                    </Badge>
                    <Badge variant="outline">Purchased {dayjs(course.createdAt).format("M/D/YY")}</Badge>
                    {userCourse?.completedAt ? (
                      <Badge variant="success">Completed {dayjs(userCourse.completedAt).format("M/D/YY")}</Badge>
                    ) : null}
                  </div>
                  <CardDescription className="line-clamp-3">{course.description}</CardDescription>
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
