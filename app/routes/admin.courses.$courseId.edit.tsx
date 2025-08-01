import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, LoaderFunctionArgs, useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import type { loader as adminCourseLoader } from "~/routes/admin.courses.$courseId";
import { checkbox, number, text } from "~/schemas/fields";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  return Responses.ok();
}

const schema = z.object({
  host: text,
  strapiId: number,
  stripePriceId: text,
  stripeProductId: text,
  requiresIdentityVerification: checkbox,
});

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const id = args.params.courseId;

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const course = await db.course.update({
    where: { id },
    data: result.data,
  });
  return Toasts.dataWithSuccess({ course }, { message: "Course updated successfully." });
}

export default function AdminEditCourse() {
  const data = useRouteLoaderData<typeof adminCourseLoader>("routes/admin.courses.$courseId");

  if (!data?.course) {
    throw new Error("Course not found.");
  }

  return (
    <>
      <title>Edit Course | Plumb Media & Education</title>
      <ValidatedForm
        id="course-form"
        method="PUT"
        schema={schema}
        defaultValues={{
          host: data.course.host,
          strapiId: data.course.strapiId.toString(),
          stripePriceId: data.course.stripePriceId,
          stripeProductId: data.course.stripeProductId,
          requiresIdentityVerification: data.course.requiresIdentityVerification,
        }}
        className="max-w-md space-y-4"
      >
        {(form) => (
          <>
            <FormField
              scope={form.scope("host")}
              required
              label="Host"
              name="host"
              description="e.g. hiphopdriving.plumbmedia.org"
            />
            <FormField
              scope={form.scope("strapiId")}
              required
              label="CMS ID"
              name="strapiId"
              description="ID of the course in the CMS"
            />
            <FormField
              scope={form.scope("stripePriceId")}
              required
              label="Stripe Price ID"
              name="stripePriceId"
              description="Refer to the Stripe dashboard"
            />
            <FormField
              required
              scope={form.scope("stripeProductId")}
              label="Stripe Product ID"
              name="stripeProductId"
              description="Refer to the Stripe dashboard"
            />
            <div className="flex items-center gap-x-2">
              <Checkbox
                id="requiresIdentityVerification"
                name="requiresIdentityVerification"
                aria-labelledby="identity-label"
                defaultChecked={data.course.requiresIdentityVerification}
              />
              <Label
                id="identity-label"
                htmlFor="requiresIdentityVerification"
                className="cursor-pointer leading-normal"
              >
                Require identity verification
              </Label>
            </div>
            <SubmitButton isSubmitting={form.formState.isSubmitting} variant="admin" className="mt-4">
              Save
            </SubmitButton>
          </>
        )}
      </ValidatedForm>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
