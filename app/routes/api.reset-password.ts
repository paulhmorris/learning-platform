import { withZod } from "@remix-validated-form/with-zod";
import { json, type ActionFunctionArgs } from "@vercel/remix";
import dayjs from "dayjs";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

const validator = withZod(z.object({ email: z.string().email() }));

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ status: 405 });
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const user = await UserService.getByEmail(result.data.email);
  if (!user) {
    return Toasts.jsonWithError(
      { message: "User not found" },
      { title: "User not found", description: `There is no user with email ${result.data.email}.` },
    );
  }

  const existingReset = await AuthService.getResetByUserId(user.id);
  if (existingReset) {
    return Toasts.jsonWithWarning(
      { message: "User not found" },
      {
        title: "Existing request found",
        description: `A password reset request has already been sent. It expires in ${dayjs(
          existingReset.expiresAt,
        ).diff(dayjs(), "minutes")} minutes.`,
      },
    );
  }

  const reset = await AuthService.generateReset(user.email);
  const { data, error } = await EmailService.sendPasswordReset({ email: user.email, token: reset.token });

  // Unknown email error
  if (error || !data) {
    Sentry.captureException(error);
    await AuthService.deleteReset(reset.id);
    return Toasts.jsonWithError(
      { error },
      { title: "Something went wrong", description: "There was an error sending the password reset email." },
    );
  }

  // Email not sent
  if ("statusCode" in data && data.statusCode !== 200) {
    // Delete the reset if there was an error emailing the user
    await AuthService.deleteReset(reset.id);
    return Toasts.jsonWithError(
      { data },
      { title: "Something went wrong", description: "There was an error sending the password reset email." },
    );
  }

  // Success
  return Toasts.jsonWithSuccess(
    { data },
    { title: "Email sent", description: "Check the email for a link to reset the password." },
  );
}
