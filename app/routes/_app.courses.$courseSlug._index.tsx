import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";

import { PageTitle } from "~/components/page-header";
import { Course, cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  try {
    const db_course = await db.course.findUniqueOrThrow({ where: { slug: courseSlug } });
    const cms_course = await cms.findOne<Course>("courses", db_course.strapiId, {
      fields: ["title"],
      populate: ["cover_image"],
    });

    // Generate srcset and sizes for the cover image server-side
    const { cover_image } = cms_course.data.attributes;
    const imgSrcSet = cover_image?.data.attributes.formats
      ? Object.entries(cover_image.data.attributes.formats)
          .map(([_key, value]) => `${process.env.STRAPI_URL}${value.url} ${value.width}w`)
          .join(", ")
      : undefined;

    const imgSizes = cover_image?.data.attributes.formats
      ? Object.entries(cover_image.data.attributes.formats)
          .map(([_key, value]) => `(max-width: ${value.width}px) ${value.width}px`)
          .join(", ")
      : undefined;

    return typedjson({ course: db_course, content: cms_course, imgSrcSet, imgSizes });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      handlePrismaError(error);
    }
    throw serverError("An error occurred while loading the course. Please try again.");
  }
}

export default function CourseIndex() {
  const { course, content, imgSrcSet, imgSizes } = useTypedLoaderData<typeof loader>();

  return (
    <div className="border border-purple-800 p-6">
      <PageTitle>{content.data.attributes.title}</PageTitle>
      <img
        height={480}
        width={700}
        fetchpriority="high"
        loading="eager"
        srcSet={imgSrcSet}
        sizes={imgSizes}
        alt={content.data.attributes.cover_image?.data.attributes.alternativeText}
      />
      <Link className="font-bold text-purple-800" to={`/courses/${course.id}/purchase`}>
        Purchase Course
      </Link>
      <pre className="text-xs">{JSON.stringify({ course, content }, null, 2)}</pre>
    </div>
  );
}
