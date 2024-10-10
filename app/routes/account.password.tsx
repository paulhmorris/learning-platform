import { MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@vercel/remix";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { verifyLogin } from "~/models/user.server";
import { loader as rootLoader } from "~/root";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/SessionService.server";

const validator = withZod(
  z
    .object({
      oldPassword: z.string().min(8, "Password must be at least 8 characters"),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmationPassword: z.string().min(8, "Password must be at least 8 characters"),
    })
    .superRefine(({ newPassword, oldPassword, confirmationPassword }, ctx) => {
      if (newPassword !== confirmationPassword) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords must match",
          path: ["confirmationPassword"],
        });
      }
      if (newPassword === oldPassword) {
        ctx.addIssue({
          code: "custom",
          message: "New password must be different from old password",
          path: ["newPassword"],
        });
      }
    }),
);

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Password | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUserId(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { oldPassword, newPassword } = result.data;

  try {
    // Verify the old password
    const verifiedUser = await verifyLogin(user.email, oldPassword);
    if (!verifiedUser) {
      return validationError({
        fieldErrors: {
          oldPassword: "Incorrect password",
        },
      });
    }

    // Update the password
    const hashedPassword = await AuthService.hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: {
        password: {
          update: {
            hash: hashedPassword,
          },
        },
      },
    });

    return Toasts.jsonWithSuccess(
      { success: true },
      { title: "Success", description: "Your password has been updated" },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { message: "Error updating password" },
      { title: "Error", description: "There was an error updating your password" },
    );
  }
}

export default function Password() {
  const user = useUser();

  return (
    <ValidatedForm id="pw-form" method="post" validator={validator} className="space-y-4" resetAfterSubmit>
      <input type="hidden" name="username" autoComplete="username" value={user.email} />
      <FormField name="oldPassword" label="Current Password" type="password" autoComplete="current-password" required />
      <FormField name="newPassword" label="New Password" type="password" autoComplete="new-password" required />
      <FormField
        name="confirmationPassword"
        label="Confirm New Password"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton variant="admin" className="sm:w-auto">
        Update
      </SubmitButton>
    </ValidatedForm>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
