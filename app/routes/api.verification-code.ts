import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, json } from "@vercel/remix";
import { validationError } from "remix-validated-form";
import { z } from "zod";

import { EMAIL_FROM_DOMAIN } from "~/config";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { AuthService } from "~/services/auth.server";

export const validator = withZod(z.object({ email: z.string().email() }));

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toLowerCase() !== "post") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const { token, user } = await AuthService.generateVerificationByEmail(result.data.email);
    await EmailService.send({
      from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
      to: user.email,
      subject: "Verify Your Email",
      html: `<p>Here's your six digit verification code: <strong>${token}</strong></p>`,
    });
    return new Response(null, { status: 201 });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { error: "An error occurred while sending the verification code. Please try again." },
      { title: "Error", description: "An error occurred while sending the verification code. Please try again." },
    );
  }
}
