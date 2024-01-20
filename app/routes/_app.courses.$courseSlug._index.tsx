import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/page-header";
import { Course, cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { notFound } from "~/lib/responses.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  const courseResults = await cms.find<Array<Course>>("courses", { populate: "cover_image" });
  if (courseResults.data.length === 0) {
    throw notFound({ message: "Course not found" });
  }
  const content = courseResults.data[0];

  const course = await db.course.findUnique({ where: { strapiId: courseResults.data[0].id } });
  if (!course) {
    throw notFound({ message: "Course not found" });
  }

  const imgSrcSet = content.attributes.cover_image?.data.attributes.formats
    ? Object.entries(content.attributes.cover_image.data.attributes.formats)
        .map(([_key, value]) => `${process.env.STRAPI_URL}${value.url} ${value.width}w`)
        .join(", ")
    : undefined;

  const imgSizes = content.attributes.cover_image?.data.attributes.formats
    ? Object.entries(content.attributes.cover_image.data.attributes.formats)
        .map(([_key, value]) => `(max-width: ${value.width}px) ${value.width}px`)
        .join(", ")
    : undefined;

  return typedjson({ course, content, imgSrcSet, imgSizes });
}

export default function CourseIndex() {
  const { course, content, imgSrcSet, imgSizes } = useTypedLoaderData<typeof loader>();

  return (
    <div className="border border-purple-800 p-6">
      <PageTitle>{content.attributes.title}</PageTitle>
      <img
        height={480}
        width={700}
        fetchpriority="high"
        loading="eager"
        srcSet={imgSrcSet}
        sizes={imgSizes}
        alt={content.attributes.cover_image?.data.attributes.alternativeText}
      />
      <Link className="font-bold text-purple-800" to={`/courses/${course.id}/purchase`}>
        Purchase Course
      </Link>
      <pre className="text-xs">{JSON.stringify({ course, content }, null, 2)}</pre>
    </div>
  );
}
