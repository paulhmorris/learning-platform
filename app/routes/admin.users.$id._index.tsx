import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { UserRole } from "~/config";
import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import type { loader } from "~/routes/admin.users.$id";
import { cuid, optionalText, selectEnum } from "~/schemas/fields";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

const logger = createLogger("Routes.AdminUserIndex");

const schema = z.object({
  id: cuid,
  role: selectEnum(UserRole),
  stripeCustomerId: optionalText,
});

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { id, ...data } = result.data;

  try {
    const updatedUser = await AuthService.updatePublicMetadata(id, data);
    return Toasts.dataWithSuccess({ updatedUser }, { message: "Success", description: "User updated successfully." });
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Failed to update user ${id}`, { error });
    return Toasts.dataWithError(null, { message: "Error", description: "Failed to update user." });
  }
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

  if (user.publicMetadata.role === UserRole.SUPERADMIN) {
    roleOptions.push({ value: UserRole.SUPERADMIN, label: "Super Admin" });
  }

  return (
    <>
      <title>User Profile | Plumb Media & Education</title>
      <pre className="text-xs text-muted-foreground">{user.id}</pre>
      <div className="mt-2 max-w-md">
        <ValidatedForm
          method="put"
          action="?index"
          schema={schema}
          defaultValues={{
            id: user.id,
            role: user.publicMetadata.role,
            stripeCustomerId: user.publicMetadata.stripeCustomerId ?? "",
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
                <FormField scope={form.scope("stripeCustomerId")} name="stripeCustomerId" label="Stripe Customer ID" />
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
