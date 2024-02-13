import { ActionFunctionArgs, json } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { nanoid } from "nanoid";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { Sentry } from "~/integrations/sentry";
import { verifyEmailJob } from "~/jobs/verify-email.server";
import { toast } from "~/lib/toast.server";

export const validator = withZod(
  z.object({
    email: z.string().email(),
  }),
);
export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toLowerCase() !== "post") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { email } = result.data;
  try {
    await verifyEmailJob.invoke({ email }, { idempotencyKey: nanoid() });
    return toast.json(
      request,
      { success: true },
      {
        title: "Verification code sent",
        description: "We've sent a verification code to your email. Please check your inbox and enter the code below.",
        type: "success",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.json(
      request,
      { error: "An error occurred while sending the verification code. Please try again." },
      {
        title: "Error",
        description: "An error occurred while sending the verification code. Please try again.",
        type: "error",
      },
    );
  }
}
