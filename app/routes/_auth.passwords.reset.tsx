import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { redirect, typedjson, useTypedActionData } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/page-header";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Sentry } from "~/integrations/sentry";
import { META } from "~/lib/constants";
import { toast } from "~/lib/toast.server";
import { MailService } from "~/services/MailService.server";
import { PasswordService } from "~/services/PasswordService.server";
import { SessionService } from "~/services/SessionService.server";

const validator = withZod(z.object({ email: z.string().email() }));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  if (userId) {
    throw redirect("/");
  }
  return typedjson({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const reset = await PasswordService.generateReset(result.data.email);
    await MailService.sendPasswordResetEmail({ email: result.data.email, token: reset.token });
    return typedjson({ success: true });
  } catch (error) {
    // If the user doesn't exist, we don't want to leak that information
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      Sentry.captureMessage("Password reset requested for non-existent user", {
        extra: { email: result.data.email },
      });

      return typedjson({ success: true });
    }

    Sentry.captureException(error);
    return toast.json(
      request,
      { success: false },
      { type: "error", title: "Error resetting passord", description: "Please try again later." },
    );
  }
};

export const meta: MetaFunction = () => [{ title: `Reset your password | ${META.titleSuffix}` }];
export default function ResetPassword() {
  // remix-validated-form validationError breaks inference
  const data = useTypedActionData() as { success?: boolean } | undefined;

  return (
    <>
      <PageTitle className="text-center">Reset your password</PageTitle>
      <AuthCard>
        {data && data.success ? (
          <p className="text-lg font-medium">
            Thanks! If your email is registered with us, you will be emailed a link to reset your password.
          </p>
        ) : (
          <ValidatedForm validator={validator} method="post" className="space-y-4">
            <FormField label="Email" name="email" type="email" autoComplete="username" required />
            <SubmitButton variant="primary-md">Get Reset Link</SubmitButton>
          </ValidatedForm>
        )}
      </AuthCard>
    </>
  );
}
