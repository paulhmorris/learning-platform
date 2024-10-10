import { UserRole } from "@prisma/client";
import { useRouteLoaderData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, MetaFunction } from "@vercel/remix";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Toasts } from "~/lib/toast.server";
import { loader } from "~/routes/admin.users.$id";
import { SessionService } from "~/services/session.server";

const validator = withZod(
  z.object({
    id: z.string().cuid(),
    firstName: z.string().max(255),
    lastName: z.string().max(255),
    email: z.string().email(),
    phone: z.string().max(20),
    role: z.nativeEnum(UserRole),
    stripeId: z.string().optional(),
  }),
);

export const meta: MetaFunction = () => {
  return [{ title: `User Profile | Plumb Media & Education` }];
};

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { id, ...rest } = result.data;

  const updatedUser = await db.user.update({
    where: { id },
    data: { ...rest },
  });
  return Toasts.jsonWithSuccess({ updatedUser }, { title: "Success", description: "User updated successfully." });
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
    <div className="max-w-md">
      <ValidatedForm
        method="put"
        action="?index"
        validator={validator}
        defaultValues={{
          email: user.email,
          stripeId: user.stripeId ?? "",
          lastName: user.lastName ?? "",
          firstName: user.firstName ?? "",
          role: user.role,
        }}
      >
        <input type="hidden" name="id" value={user.id} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <FormField required name="firstName" label="First Name" autoComplete="given-name" maxLength={255} />
            <FormField required name="lastName" label="Last Name" autoComplete="family-name" maxLength={255} />
          </div>
          <FormField required name="email" label="Email" type="email" autoComplete="email" maxLength={255} />
          <FormSelect name="role" label="Role" placeholder="Choose a role" options={roleOptions} required />
          <FormField name="phone" label="Phone" type="tel" autoComplete="tel" maxLength={20} />
          <FormField name="stripeId" label="Stripe ID" />
          <SubmitButton variant="admin" className="sm:w-auto">
            Save
          </SubmitButton>
        </div>
      </ValidatedForm>
    </div>
  );
}
