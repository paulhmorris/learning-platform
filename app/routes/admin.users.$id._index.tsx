import { UserRole } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, MetaFunction, useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Toasts } from "~/lib/toast.server";
import { loader } from "~/routes/admin.users.$id";
import { cuid, email, optionalText, phoneNumber, selectEnum, text } from "~/schemas/fields";
import { SessionService } from "~/services/session.server";

const schema = z.object({
  id: cuid,
  firstName: text,
  lastName: optionalText,
  email: email,
  phone: phoneNumber,
  role: selectEnum(UserRole),
  stripeId: optionalText,
});

export const meta: MetaFunction = () => {
  return [{ title: `User Profile | Plumb Media & Education` }];
};

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { id, ...rest } = result.data;

  const updatedUser = await db.user.update({
    where: { id },
    data: { ...rest },
  });
  return Toasts.dataWithSuccess({ updatedUser }, { message: "Success", description: "User updated successfully." });
}

export default function AdminUserIndex() {
  const userData = useRouteLoaderData<typeof loader>("routes/admin.users.$id");

  if (!userData) {
    throw new Error("User not found.");
  }

  const { user } = userData;

  const roleOptions: Array<{ value: UserRole; label: string }> = [
    { value: UserRole.USER, label: "User" },
    { value: UserRole.ADMIN, label: "Admin" },
  ];

  if (user.role === UserRole.SUPERADMIN) {
    roleOptions.push({ value: UserRole.SUPERADMIN, label: "Super Admin" });
  }

  return (
    <>
      <title>User Profile | Plumb Media & Education</title>
      <div className="max-w-md">
        <ValidatedForm
          method="put"
          action="?index"
          schema={schema}
          defaultValues={{
            id: user.id,
            email: user.email,
            phone: user.phone ?? "",
            stripeId: user.stripeId ?? "",
            lastName: user.lastName ?? "",
            firstName: user.firstName ?? "",
            role: user.role,
          }}
        >
          {(form) => (
            <>
              <input type="hidden" name="id" value={user.id} />
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
                  Save
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
