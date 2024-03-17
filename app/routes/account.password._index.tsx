import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { resetPasswordValidator } from "~/routes/_auth.passwords.new";
import { SessionService } from "~/services/SessionService.server";

const validator = withZod(
  z
    .object({
      oldPassword: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmation: z.string().min(8, "Password must be at least 8 characters"),
    })
    .superRefine(({ newPassword, confirmation }, ctx) => {
      if (newPassword !== confirmation) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords must match",
          path: ["confirmation"],
        });
      }
    }),
);

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUserId(request);
  return typedjson({});
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { oldPassword, newPassword } = result.data;
}

export default function Password() {
  return (
    <ValidatedForm validator={resetPasswordValidator} className="max-w-sm space-y-4">
      <FormField
        name="current-passwrd"
        label="Current Password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormField name="new-password" label="New Password" type="password" autoComplete="new-password" required />
      <FormField
        name="confirm-password"
        label="Confirm Password"
        type="password"
        autoComplete="new-password"
        required
      />
      <Button variant="primary-md">Save</Button>
    </ValidatedForm>
  );
}
