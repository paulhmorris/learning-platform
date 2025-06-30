import { parseFormData, validationError } from "@rvf/react-router";
import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { EMAIL_FROM_DOMAIN } from "~/config";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { AuthService } from "~/services/auth.server";

export const schema = z.object({ email: z.string().email() });

export async function action({ request }: ActionFunctionArgs) {
  if (request.method.toLowerCase() !== "post") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await parseFormData(request, schema);
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
    return Toasts.dataWithError(
      { error: "An error occurred while sending the verification code. Please try again." },
      { message: "Error", description: "An error occurred while sending the verification code. Please try again." },
    );
  }
}
