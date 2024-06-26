import type { ActionFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import dayjs from "dayjs";
import { typedjson } from "remix-typedjson";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { PasswordService } from "~/services/PasswordService.server";
import { UserService } from "~/services/UserService.server";

const validator = withZod(z.object({ email: z.string().email() }));

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return typedjson({ status: 405 });
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const user = await UserService.getByEmail(result.data.email);
  if (!user) {
    return toast.json(
      request,
      { message: "User not found" },
      {
        type: "error",
        title: "User not found",
        description: `There is no user with email ${result.data.email}.`,
      },
    );
  }

  const existingReset = await PasswordService.getResetByUserId(user.id);
  if (existingReset) {
    return toast.json(
      request,
      { message: "User not found" },
      {
        type: "warning",
        title: "Existing request found",
        description: `A password reset request has already been sent. It expires in ${dayjs(
          existingReset.expiresAt,
        ).diff(dayjs(), "minutes")} minutes.`,
      },
    );
  }

  const reset = await PasswordService.generateReset(user.email);
  const { data, error } = await EmailService.sendPasswordSetup({ email: user.email, token: reset.token });

  // Unknown email error
  if (error || !data) {
    Sentry.captureException(error);
    await PasswordService.deleteReset(reset.id);
    return toast.json(
      request,
      { error },
      {
        type: "error",
        title: "Something went wrong",
        description: "There was an error sending the password reset email.",
      },
    );
  }

  // Email not sent
  if ("statusCode" in data && data.statusCode !== 200) {
    // Delete the reset if there was an error emailing the user
    await PasswordService.deleteReset(reset.id);
    return toast.json(
      request,
      { data },
      {
        type: "error",
        title: "Something went wrong",
        description: "There was an error sending the password reset email.",
      },
    );
  }

  // Success
  return toast.json(
    request,
    { data },
    {
      type: "default",
      title: "Email sent",
      description: "Check the email for a link to reset the password.",
    },
  );
}
