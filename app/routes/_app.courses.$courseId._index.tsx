import { LoaderFunctionArgs, json } from "@remix-run/node";
import invariant from "tiny-invariant";

import { getEntries } from "~/integrations/strapi.server.";
import { prisma } from "~/lib/db.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const courseId = params.courseId;
  invariant(courseId, "Course ID is required");

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return json({ message: "Course not found" }, { status: 404 });
  }

  console.log(course.strapiId);
  const content = await getEntries("courses");
  if (!content) {
    return json({ message: "Course content not found" }, { status: 404 });
  }

  return json({ course, content });
}
