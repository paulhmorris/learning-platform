import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { IconArrowLeft } from "@tabler/icons-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { getCoursefromCMSForRoot } from "~/models/course.server";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.courseId;

  try {
    const dbCourse = await db.course.findUniqueOrThrow({ where: { id } });
    const cmsCourse = await getCoursefromCMSForRoot(dbCourse.strapiId);
    if (!cmsCourse) {
      throw new Error("No course found in CMS.");
    }
    const course = {
      ...dbCourse,
      title: cmsCourse.data.attributes.title,
      description: cmsCourse.data.attributes.description ?? "",
    };
    return typedjson({ course });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw new Response("An error occurred while fetching the course.", { status: 500 });
  }
}

const validator = withZod(
  z.object({
    host: z.string({ message: "Host is required" }),
  }),
);

export async function action({ request, params }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.courseId;

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { host } = result.data;
  try {
    const course = await db.course.update({
      where: { id },
      data: { host },
    });
    return toast.redirect(request, `/admin/courses/${course.id}`, {
      title: "Course updated successfully.",
      type: "success",
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.redirect(request, `/admin/courses/${id}`, {
      title: "An error occurred while updating the course.",
      description: error instanceof Error ? error.message : undefined,
      type: "error",
    });
  }
}

export default function AdminEditCourse() {
  const { course } = useTypedLoaderData<typeof loader>();

  return (
    <div>
      <Link
        to="/admin/courses"
        className="group inline-flex items-center gap-2 rounded ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <IconArrowLeft className="size-[1.125rem] transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
        <span>Back to courses</span>
      </Link>
      <h1 className="mt-4 text-3xl">{course.title}</h1>
      {course.description ? <p className="mt-1 text-sm text-muted-foreground">{course.description}</p> : null}
      <div className="mt-4 max-w-sm">
        <ValidatedForm method="PUT" validator={validator} defaultValues={{ host: course.host }}>
          <FormField required label="Host" name="host" description="e.g. course.hiphopdriving.com" />
          <SubmitButton variant="admin" className="mt-4">
            Save
          </SubmitButton>
        </ValidatedForm>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
