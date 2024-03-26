import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { verifyLogin } from "~/models/user.server";
import { loader as rootLoader } from "~/root";
import { PasswordService } from "~/services/PasswordService.server";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

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

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Password | ${match?.data?.attributes.title}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUserId(request);
  return typedjson({});
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
    const hashedPassword = await PasswordService.hashPassword(newPassword);
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

    return toast.json(
      request,
      { message: "Password updated" },
      {
        title: "Success",
        type: "success",
        description: "Your password has been updated",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.json(
      request,
      { message: "Error updating password" },
      {
        title: "Error",
        type: "error",
        description: "There was an error updating your password",
      },
    );
  }
}

export default function Password() {
  const user = useUser();

  return (
    <ValidatedForm id="pw-form" method="post" validator={validator} className="space-y-4">
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
        Save
      </SubmitButton>
    </ValidatedForm>
  );
}
