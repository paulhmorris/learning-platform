import { parseFormData, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import { type ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

const schema = z.object({ email: z.string().email() });

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return { status: 405 };
  }

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const user = await UserService.getByEmail(result.data.email);
  if (!user) {
    return Toasts.dataWithError(
      { message: "User not found" },
      { message: "User not found", description: `There is no user with email ${result.data.email}.` },
    );
  }

  const existingReset = await AuthService.getResetByUserId(user.id);
  if (existingReset) {
    return Toasts.dataWithWarning(
      { message: "User not found" },
      {
        message: "Existing request found",
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
    return Toasts.dataWithError(
      { error },
      { message: "Something went wrong", description: "There was an error sending the password reset email." },
    );
  }

  // Email not sent
  if ("statusCode" in data && data.statusCode !== 200) {
    // Delete the reset if there was an error emailing the user
    await AuthService.deleteReset(reset.id);
    return Toasts.dataWithError(
      { data },
      { message: "Something went wrong", description: "There was an error sending the password reset email." },
    );
  }

  // Success
  return Toasts.dataWithSuccess(
    { data },
    { message: "Email sent", description: "Check the email for a link to reset the password." },
  );
}
