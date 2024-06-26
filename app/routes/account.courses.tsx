import { LoaderFunctionArgs } from "@remix-run/node";
import { IconExternalLink } from "@tabler/icons-react";
import dayjs from "dayjs";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { ErrorComponent } from "~/components/error-component";
import { db } from "~/integrations/db.server";
import { getAllCourses } from "~/models/course.server";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Profile | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const dbCourses = await db.userCourses.findMany({ where: { userId }, include: { course: true } });
  const cmsCourses = await getAllCourses();

  if (!cmsCourses.length) {
    throw new Response("Failed to fetch courses", { status: 500 });
  }

  const courses = dbCourses.map((dbCourse) => {
    const cmsCourse = cmsCourses.find((course) => course.id === dbCourse.course.strapiId);
    return {
      ...dbCourse,
      title: cmsCourse?.attributes.title,
      description: cmsCourse?.attributes.description,
    };
  });

  return typedjson({ courses });
}

export default function AccountCourses() {
  const { courses } = useTypedLoaderData<typeof loader>();
  return (
    <>
      <h1 className="sr-only">Courses</h1>
      <p className="text-base">
        {courses.length > 0
          ? "You are enrolled in the following courses"
          : "You are not currently enrolled in any courses"}
      </p>
      <ul className="mt-4">
        {courses.map((course) => (
          <li key={course.id}>
            <a
              className="flex items-center justify-between rounded-2xl border px-4 py-6 shadow transition hover:bg-secondary"
              href={new URL("/", `https://${course.course.host}`).toString()}
              target="_blank"
              rel="noreferrer"
            >
              <div>
                <h2 className="text-base sm:text-lg">{course.title}</h2>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <p className="text-xs">{course.isCompleted ? "Complete" : "Incomplete"}</p>
                  <span className="text-xs">•</span>
                  <p className="text-xs">Purchased {dayjs(course.createdAt).format("M/D/YY")}</p>
                </div>
              </div>
              <IconExternalLink />
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
