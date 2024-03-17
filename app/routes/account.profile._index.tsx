import { MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm } from "remix-validated-form";
import { z } from "zod";

import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/lib/utils";

const validator = withZod(
  z.object({
    id: z.string().cuid(),
    firstName: z.string().max(255),
    lastName: z.string().max(255),
    email: z.string().email(),
    phone: z.string().max(20),
  }),
);

export const meta: MetaFunction = () => [{ title: "Account" }];

export default function AccountProfile() {
  const user = useUser();

  return (
    <>
      <ValidatedForm
        validator={validator}
        defaultValues={{
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email,
        }}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <FormField required name="firstName" label="First Name" autoComplete="given-name" maxLength={255} />
            <FormField required name="lastName" label="Last Name" autoComplete="family-name" maxLength={255} />
          </div>
          <FormField required name="email" label="Email" type="email" autoComplete="email" />
          <FormField name="phone" label="Phone" type="tel" autoComplete="tel" maxLength={20} />
          <SubmitButton variant="primary-md" className="sm:w-auto">
            Save
          </SubmitButton>
        </div>
      </ValidatedForm>
    </>
  );
}
