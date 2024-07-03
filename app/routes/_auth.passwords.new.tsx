import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { unauthorized } from "~/lib/responses.server";
import { sessionStorage } from "~/lib/session.server";
import { toast } from "~/lib/toast.server";
import { getSearchParam } from "~/lib/utils";
import { PasswordService } from "~/services/PasswordService.server";
import { SessionService } from "~/services/SessionService.server";
import { UserService } from "~/services/UserService.server";

export const resetPasswordValidator = withZod(
  z
    .object({
      token: z.string(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmation: z.string().min(8, "Password must be at least 8 characters"),
    })
    .superRefine(({ newPassword, confirmation }, ctx) => {
      if (newPassword !== confirmation) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords must match",
          path: ["confirmation"],
        });
      }
    }),
);

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await SessionService.getSession(request);
  const token = getSearchParam("token", request);
  if (!token) {
    throw unauthorized("No token provided");
  }

  const reset = await PasswordService.getResetByToken(token);
  if (!reset || reset.expiresAt < new Date()) {
    throw unauthorized("Invalid token");
  }

  return json(null, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const tokenParam = getSearchParam("token", request);

  // Validate form
  const result = await resetPasswordValidator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  // Check token
  const { newPassword, token } = result.data;
  const reset = await PasswordService.getResetByToken(token);
  if (!reset) {
    return toast.json(request, {}, { type: "error", title: "Token not found", description: "Please try again." });
  }

  // Check expiration
  if (reset.expiresAt < new Date()) {
    return toast.json(request, {}, { type: "error", title: "Token expired", description: "Please try again." });
  }

  // Check token against param
  if (token !== tokenParam) {
    return toast.json(
      request,
      { success: false },
      { type: "error", title: "Invalid token", description: "Please try again." },
    );
  }

  // Check user
  const userFromToken = await UserService.getById(reset.userId);
  if (!userFromToken) {
    return toast.json(
      request,
      { success: false },
      { type: "error", title: "User not found", description: "Please try again." },
    );
  }

  await UserService.resetOrSetupPassword({ userId: userFromToken.id, password: newPassword });

  // Use token
  await PasswordService.expireReset(token);

  // Logout and redirect to login
  await SessionService.logout(request);

  return json({ ok: true });
}

export default function NewPassword() {
  const [searchParams] = useSearchParams();

  return (
    <AuthCard>
      <PageTitle className="text-4xl font-extrabold">Set a new password.</PageTitle>
      <ValidatedForm id="password-form" validator={resetPasswordValidator} method="post" className="mt-4 space-y-4">
        <input type="hidden" name="token" value={searchParams.get("token") ?? ""} />
        <FormField label="New Password" name="newPassword" type="password" autoComplete="new-password" required />
        <FormField
          label="Confirm New Password"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton>Set Password</SubmitButton>
      </ValidatedForm>
    </AuthCard>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
