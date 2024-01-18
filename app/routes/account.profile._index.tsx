import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm } from "remix-validated-form";
import { z } from "zod";

import { PageTitle } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField } from "~/components/ui/form";
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

export default function AccountProfile() {
  const user = useUser();

  return (
    <>
      <PageTitle className="mb-12">Profile</PageTitle>
      <ValidatedForm
        validator={validator}
        defaultValues={{
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email,
        }}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <FormField required name="firstName" label="First Name" autoComplete="given-name" maxLength={255} />
            <FormField required name="lastName" label="Last Name" autoComplete="family-name" maxLength={255} />
          </div>
          <FormField
            required
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            description="This is what you log in with"
          />
          <FormField name="phone" label="Phone" type="tel" autoComplete="tel" maxLength={20} />
          <ButtonGroup>
            <Button>Save</Button>
            <Button variant="secondary" type="reset">
              Reset
            </Button>
          </ButtonGroup>
        </div>
      </ValidatedForm>
    </>
  );
}
