import { UserRole } from "@prisma/client";
import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, MetaFunction } from "@vercel/remix";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

const validator = withZod(
  z.object({
    firstName: z.string().max(255),
    lastName: z.string().max(255),
    email: z.string().email(),
    phone: z.string().max(20),
    stripeId: z.string().optional(),
    role: z.nativeEnum(UserRole),
  }),
);

export const meta: MetaFunction = () => {
  return [{ title: `New User | Plumb Media & Education` }];
};

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const newUser = await db.user.create({ data: result.data });
    return Toasts.redirectWithSuccess(`/admin/users/${newUser.id}`, { title: "User Created" });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { message: "An error occurred while creating this user." },
      { title: "Unknown Error", description: "An error occurred while creating this user." },
    );
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
    <div className="max-w-md">
      <h1 className="text-3xl">New User</h1>
      <ValidatedForm method="post" validator={validator} className="mt-4">
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
            Create
          </SubmitButton>
        </div>
      </ValidatedForm>
    </div>
  );
}
