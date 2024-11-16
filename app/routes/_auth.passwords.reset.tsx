import { Prisma } from "@prisma/client";
import { Link, MetaFunction, useActionData } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, json, LoaderFunctionArgs, redirect } from "@vercel/remix";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { EmailService } from "~/integrations/email.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { loader as rootLoader } from "~/root";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

const validator = withZod(z.object({ email: z.string().email() }));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  if (userId) {
    throw redirect("/");
  }
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const existingReset = await AuthService.getResetByUserId(result.data.email);
    // If a reset already exists, just exit inconspicuously
    if (existingReset) {
      return json({ success: true });
    }
    const reset = await AuthService.generateReset(result.data.email);
    await EmailService.sendPasswordReset({ email: result.data.email, token: reset.token });
    return json({ success: true });
  } catch (error) {
    // If the user doesn't exist, we don't want to leak that information
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      Sentry.captureMessage("Password reset requested for non-existent user", {
        extra: { email: result.data.email },
      });

      return json({ success: true });
    }

    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { success: false },
      { title: "Error resetting password", description: "Please try again later." },
    );
  }
};

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Reset Your Password | ${match?.data?.attributes.title}` }];
};

export default function ResetPassword() {
  // remix-validated-form validationError breaks inference
  const data = useActionData() as { success?: boolean } | undefined;

  return (
    <>
      <AuthCard>
        <PageTitle className="mb-4 text-center sm:mb-8 sm:text-left">Reset your password</PageTitle>
        {data && data.success ? (
          <p className="text-lg font-medium">
            Thanks! If your email is registered with us, you will be emailed a link to reset your password.
          </p>
        ) : (
          <ValidatedForm validator={validator} method="post" className="space-y-4">
            <FormField label="Email" name="email" type="email" autoComplete="username" required maxLength={255} />
            <SubmitButton variant="primary-md">Get Reset Link</SubmitButton>
          </ValidatedForm>
        )}
      </AuthCard>
      <p className="space-x-2 text-center text-sm">
        <Link to="/join" className="text-sm font-bold">
          Sign up
        </Link>
        <span>|</span>
        <Link to="/login" className="text-sm font-bold">
          Log in
        </Link>
      </p>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
