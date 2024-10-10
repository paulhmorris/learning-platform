import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, json } from "@vercel/remix";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { verifyEmailJob } from "jobs/verify-email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";

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
    const { id } = await verifyEmailJob.trigger({ email });
    if (id) {
      return Toasts.jsonWithSuccess({ success: true }, { title: "Verification code sent" });
    } else {
      return Toasts.jsonWithError(
        { error: "An error occurred while sending the verification code. Please try again." },
        { title: "Error", description: "An error occurred while sending the verification code. Please try again." },
      );
    }
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { error: "An error occurred while sending the verification code. Please try again." },
      { title: "Error", description: "An error occurred while sending the verification code. Please try again." },
    );
  }
}
