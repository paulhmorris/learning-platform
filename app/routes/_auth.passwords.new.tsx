import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { ErrorComponent } from "~/components/error-component";
import { PageTitle } from "~/components/page-header";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { unauthorized } from "~/lib/responses.server";
import { sessionStorage } from "~/lib/session.server";
import { toast } from "~/lib/toast.server";
import { getSearchParam } from "~/lib/utils";
import { verifyLogin } from "~/models/user.server";
import { PasswordService } from "~/services/PasswordService.server";
import { SessionService } from "~/services/SessionService.server";
import { UserService } from "~/services/UserService.server";

const validator = withZod(
  z
    .object({
      token: z.string(),
      isReset: z.string().transform((val) => val === "true"),
      oldPassword: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmation: z.string().min(8, "Password must be at least 8 characters"),
    })
    .superRefine(({ oldPassword, newPassword, confirmation, isReset }, ctx) => {
      if (newPassword !== confirmation) {
        ctx.addIssue({
          code: "custom",
          message: "Passwords must match",
          path: ["confirmation"],
        });
      }
      if (isReset && !oldPassword) {
        ctx.addIssue({
          code: "custom",
          message: "Old password is required",
          path: ["oldPassword"],
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

  return typedjson(null, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const tokenParam = getSearchParam("token", request);
  const isReset = getSearchParam("isReset", request) === "true";

  // Validate form
  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  // Check token
  const { oldPassword, newPassword, token } = result.data;
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

  // Reset flow
  if (isReset) {
    // Check old password is correct
    const user = await verifyLogin(userFromToken.email, oldPassword);
    if (!user) {
      return validationError({
        fieldErrors: {
          oldPassword: "Incorrect password",
        },
      });
    }

    // Reset password
    await UserService.resetOrSetupPassword({ userId: user.id, password: newPassword });
  } else {
    // Setup flow
    await UserService.resetOrSetupPassword({ userId: userFromToken.id, password: newPassword });
  }

  // Use token
  await PasswordService.expireReset(token);

  return toast.redirect(request, "/login", {
    type: "success",
    title: `Password ${isReset ? "reset" : "set up"}`,
    description: `Your password has been ${isReset ? "reset" : "set up"}. Login with your new password.`,
  });
}

export default function NewPassword() {
  const [searchParams] = useSearchParams();
  const isReset = searchParams.get("isReset") === "true";

  return (
    <div className="grid h-full place-items-center">
      <div className="max-w-lg px-8">
        <PageTitle className="text-4xl font-extrabold">Set a new password.</PageTitle>
        <ValidatedForm id="password-form" validator={validator} method="post" className="mt-4 space-y-4">
          <input type="hidden" name="token" value={searchParams.get("token") ?? ""} />
          <input type="hidden" name="isReset" value={String(isReset)} />
          {isReset ? (
            <FormField
              label="Old password"
              name="oldPassword"
              type="password"
              autoComplete="current-password"
              required={isReset}
            />
          ) : (
            <input type="hidden" name="oldPassword" value="" />
          )}
          <FormField label="New Password" name="newPassword" type="password" autoComplete="new-password" required />
          <FormField
            label="Confirm New Password"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
          />
          <SubmitButton>{isReset ? "Reset" : "Create"} Password</SubmitButton>
        </ValidatedForm>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
