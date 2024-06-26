import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { BackLink } from "~/components/common/back-link";
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
      <BackLink to="/admin/courses">Back to courses</BackLink>
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
