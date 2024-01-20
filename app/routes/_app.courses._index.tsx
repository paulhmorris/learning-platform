import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { Course, cms } from "~/integrations/cms.server";

export async function loader() {
  const courses = await cms.find<Array<Course>>("courses");
  return typedjson({ courses });
}

export default function CoursesIndex() {
  const { courses } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <h1>Courses</h1>
      <ul>
        {courses.data.map((course) => (
          <li key={course.id}>
            <Link to={`/courses/${course.attributes.slug}`}>{course.attributes.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
