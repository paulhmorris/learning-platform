import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { MetaFunction, useLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { BackLink } from "~/components/common/back-link";
import { ErrorComponent } from "~/components/error-component";
import { Checkbox, FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { getPrismaErrorText } from "~/lib/responses.server";
import { CheckboxSchema } from "~/lib/schemas";
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
    return json({ course });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw new Response("An error occurred while fetching the course.", { status: 500 });
  }
}

const validator = withZod(
  z.object({
    host: z.string({ message: "Host is required" }),
    strapiId: z.coerce.number({ message: "Strapi ID is required" }),
    stripePriceId: z.string({ message: "Stripe price ID is required" }),
    stripeProductId: z.string({ message: "Stripe product ID is required" }),
    requiresIdentityVerification: CheckboxSchema,
  }),
);

export async function action({ request, params }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const id = params.courseId;

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const course = await db.course.update({
      where: { id },
      data: result.data,
    });
    return toast.json(
      request,
      { course },
      {
        title: "Course updated successfully.",
        type: "success",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    let message = error instanceof Error ? error.message : "An error occurred while updating the course.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      message = getPrismaErrorText(error);
    }
    return toast.json(
      request,
      { ok: false },
      {
        title: "Error.",
        description: message,
        type: "error",
      },
      { status: 500 },
    );
  }
}

export const meta: MetaFunction = () => [{ title: "Edit Course | Plumb Media & Education" }];

export default function AdminEditCourse() {
  const { course } = useLoaderData<typeof loader>();

  return (
    <div>
      <BackLink to="/admin/courses">Back to courses</BackLink>
      <h1 className="mt-4 text-3xl">{course.title}</h1>
      {course.description ? <p className="mt-1 text-sm text-muted-foreground">{course.description}</p> : null}
      <div className="mt-4 max-w-sm">
        <ValidatedForm
          id="course-form"
          method="PUT"
          validator={validator}
          defaultValues={{ ...course }}
          className="space-y-4"
        >
          <FormField required label="Host" name="host" description="e.g. course.hiphopdriving.com" />
          <FormField required label="CMS ID" name="strapiId" description="ID of the course in the CMS" />
          <FormField
            required
            label="Stripe Price ID"
            name="stripePriceId"
            description="Refer to the Stripe dashboard"
          />
          <FormField
            required
            label="Stripe Product ID"
            name="stripeProductId"
            description="Refer to the Stripe dashboard"
          />
          <div className="flex items-center gap-x-2">
            <Checkbox
              id="requiresIdentityVerification"
              name="requiresIdentityVerification"
              aria-labelledby="identity-label"
              defaultChecked={course.requiresIdentityVerification}
            />
            <Label id="identity-label" htmlFor="requiresIdentityVerification" className="cursor-pointer">
              Require identity verification to complete
            </Label>
          </div>
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
