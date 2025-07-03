import { UserRole } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, MetaFunction } from "react-router";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { email, optionalText, phoneNumber, selectEnum, text } from "~/schemas/fields";
import { SessionService } from "~/services/session.server";

const schema = z.object({
  firstName: text,
  lastName: text,
  email: email,
  phone: phoneNumber,
  stripeId: optionalText,
  role: selectEnum(UserRole),
});

export const meta: MetaFunction = () => {
  return [{ title: `New User | Plumb Media & Education` }];
};

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const newUser = await db.user.create({ data: result.data });
    return Toasts.redirectWithSuccess(`/admin/users/${newUser.id}`, { message: "User Created" });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(null, {
      message: "Unknown Error",
      description: "An error occurred while creating this user.",
    });
  }
}

export default function AdminUserNew() {
  const user = useUser();

  const roleOptions: Array<{ value: UserRole; label: string }> = [
    { value: UserRole.USER, label: "User" },
    { value: UserRole.ADMIN, label: "Admin" },
  ];

  if (user.role === UserRole.SUPERADMIN) {
    roleOptions.push({ value: UserRole.SUPERADMIN, label: "Super Admin" });
  }

  return (
    <>
      <title>New User | Plumb Media & Education</title>
      <div className="max-w-md">
        <h1 className="text-3xl">New User</h1>
        <ValidatedForm
          method="post"
          schema={schema}
          defaultValues={{
            role: UserRole.USER,
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            stripeId: "",
          }}
          className="mt-4"
        >
          {(form) => (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <FormField required label="First Name" name="firstName" scope={form.scope("firstName")} />
                  <FormField label="Last Name" name="lastName" scope={form.scope("lastName")} />
                </div>
                <FormField
                  required
                  label="Email"
                  name="email"
                  type="email"
                  inputMode="email"
                  scope={form.scope("email")}
                />
                <FormSelect
                  required
                  label="Role"
                  name="role"
                  placeholder="Choose a role"
                  options={roleOptions}
                  scope={form.scope("role")}
                />
                <FormField label="Phone" name="phone" type="tel" inputMode="tel" scope={form.scope("phone")} />
                <FormField scope={form.scope("stripeId")} name="stripeId" label="Stripe ID" />
                <SubmitButton variant="admin" className="sm:w-auto">
                  Create
                </SubmitButton>
              </div>
            </>
          )}
        </ValidatedForm>
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
