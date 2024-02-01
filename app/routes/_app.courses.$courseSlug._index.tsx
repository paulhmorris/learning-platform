import { Prisma } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import invariant from "tiny-invariant";

import { ErrorComponent } from "~/components/error-component";
import { PageTitle } from "~/components/page-header";
import { Course, cms } from "~/integrations/cms.server";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { handlePrismaError, serverError } from "~/lib/responses.server";
import { generateImgSizes, generateImgSrcSet } from "~/lib/utils";

export async function loader({ params }: LoaderFunctionArgs) {
  const courseSlug = params.courseSlug;
  invariant(courseSlug, "Course slug is required");

  try {
    const db_course = await db.course.findUniqueOrThrow({ where: { slug: courseSlug } });
    const cms_course = await cms.findOne<Course>("courses", db_course.strapiId, {
      fields: ["title"],
      populate: {
        cover_image: {
          fields: ["alternativeText", "formats"],
        },
        lessons: {
          fields: ["title", "slug"],
        },
      },
    });

    // Generate srcset and sizes for the cover image server-side
    const formats = cms_course.data.attributes.cover_image?.data.attributes.formats;
    const imgSrcSet = formats ? generateImgSrcSet(formats) : undefined;
    const imgSizes = formats ? generateImgSizes(formats) : undefined;

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
      <h2>Lessons</h2>
      <ul>
        {content.data.attributes.lessons?.data.map((lesson) => {
          return (
            <li key={`lesson-${lesson.id}`}>
              <Link to={`/courses/${course.slug}/${lesson.attributes.slug}`}>{lesson.attributes.title}</Link>
            </li>
          );
        })}
      </ul>
      <pre className="text-xs">{JSON.stringify({ course, content }, null, 2)}</pre>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
