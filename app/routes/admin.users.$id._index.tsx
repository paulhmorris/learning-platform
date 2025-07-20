import { UserRole } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, MetaFunction, useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Toasts } from "~/lib/toast.server";
import type { loader } from "~/routes/admin.users.$id";
import { cuid, optionalText, selectEnum } from "~/schemas/fields";
import { SessionService } from "~/services/session.server";

const schema = z.object({
  id: cuid,
  role: selectEnum(UserRole),
  stripeId: optionalText,
});

export const meta: MetaFunction = () => {
  return [{ title: `User Profile | Plumb Media & Education` }];
};

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);

  const result = await parseFormData(args.request, schema);
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
            role: user.role,
            stripeId: user.stripeId ?? "",
          }}
        >
          {(form) => (
            <>
              <input type="hidden" name="id" value={user.id} />
              <div className="space-y-4">
                <FormSelect
                  required
                  label="Role"
                  name="role"
                  placeholder="Choose a role"
                  options={roleOptions}
                  scope={form.scope("role")}
                />
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
