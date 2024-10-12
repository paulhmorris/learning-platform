import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, json } from "@vercel/remix";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { AuthService } from "~/services/auth.server";

export const validator = withZod(z.object({ userId: z.string() }));

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toLowerCase() !== "post") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    await AuthService.generateVerification(result.data.userId);
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { error: "An error occurred while sending the verification code. Please try again." },
      { title: "Error", description: "An error occurred while sending the verification code. Please try again." },
    );
  }
}
