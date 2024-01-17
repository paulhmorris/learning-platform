import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";

import { cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { notFound } from "~/lib/responses.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  const course = await db.course.findUnique({ where: { slug: courseSlug } });
  if (!course || !course.strapiId) {
    throw notFound({ message: "Course not found" });
  }

  const content = await cms.getCourse(course.strapiId);
  if (!content) {
    throw notFound({ message: "Content not found" });
  }

  return typedjson({ course, content });
}

export default function CourseLayout() {
  return (
    <div className="border border-destructive p-6">
      <h1>Course Layout</h1>
      <Outlet />
    </div>
  );
}
