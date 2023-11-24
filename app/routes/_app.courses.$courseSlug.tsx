import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import invariant from "tiny-invariant";

import { getEntry } from "~/integrations/strapi.server.";
import { prisma } from "~/lib/db.server";
import { notFound } from "~/lib/responses.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  const course = await prisma.course.findUnique({ where: { slug: courseSlug } });
  if (!course) {
    throw notFound({ message: "Course not found" });
  }

  const content = await getEntry("courses", course.strapiId);
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
