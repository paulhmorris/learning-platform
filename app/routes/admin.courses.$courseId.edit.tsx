import { parseFormData, useField, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, LoaderFunctionArgs, useLoaderData, useRouteLoaderData } from "react-router";
import type Stripe from "stripe";
import * as z from "zod";

import { ErrorComponent } from "~/components/error-component";
import { Checkbox } from "~/components/ui/checkbox";
import { ComboboxMultiple } from "~/components/ui/combobox";
import { FormField, GenericFieldError } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";
import { Toasts } from "~/lib/toast.server";
import type { loader as adminCourseLoader } from "~/routes/admin.courses.$courseId";
import { checkbox, checkboxGroup, number, text } from "~/schemas/fields";
import { SessionService } from "~/services/session.server";

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);

  const prices = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
  const priceOptions = prices.data
    .filter((price) => typeof price.product === "object" && !price.product.deleted)
    .map((price) => {
      const product = price.product as Stripe.Product;
      const amount =
        price.unit_amount != null
          ? new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency }).format(
              price.unit_amount / 100,
            )
          : null;
      return {
        value: price.id,
        label: `${product.name} — ${price.nickname ?? amount ?? price.id}`,
      };
    });

  return { priceOptions };
}

const schema = z.object({
  host: text,
  strapiId: number,
  stripePriceIds: checkboxGroup,
  requiresIdentityVerification: checkbox,
  issuesCertificate: checkbox,
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
  const { priceOptions } = useLoaderData<typeof loader>();

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
          stripePriceIds: data.course.stripePriceIds,
          requiresIdentityVerification: data.course.requiresIdentityVerification,
          issuesCertificate: data.course.issuesCertificate,
        }}
        className="max-w-md space-y-4"
      >
        {(form) => {
          const stripePriceIdsField = useField(form.scope("stripePriceIds"));
          const rawValue = stripePriceIdsField.value();
          const selectedPriceIds = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
          return (
            <>
              <FormField
                scope={form.scope("host")}
                required
                label="Host"
                name="host"
                description="e.g. hiphopdriving.plumblearning.com"
              />
              <FormField
                scope={form.scope("strapiId")}
                required
                label="CMS ID"
                name="strapiId"
                description="ID of the course in the CMS"
              />
              <div>
                <Label>Stripe Prices</Label>
                {selectedPriceIds.map((priceId) => (
                  <input key={priceId} type="hidden" name={stripePriceIdsField.name()} value={priceId} />
                ))}
                <ComboboxMultiple
                  className="mt-0.5"
                  options={priceOptions}
                  value={selectedPriceIds}
                  onChange={(value) => stripePriceIdsField.setValue(value)}
                  placeholder="Select Stripe prices..."
                  emptyText="No active Stripe prices found."
                />
                <GenericFieldError error={stripePriceIdsField.error()} />
              </div>
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
          );
        }}
      </ValidatedForm>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
