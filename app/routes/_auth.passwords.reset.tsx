import { Prisma } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { redirect, typedjson, useTypedActionData } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/common/page-title";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { loader as rootLoader } from "~/root";
import { MailService } from "~/services/MailService.server";
import { PasswordService } from "~/services/PasswordService.server";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

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

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Reset Your Password | ${match?.data?.attributes.title}` }];
};

export default function ResetPassword() {
  // remix-validated-form validationError breaks inference
  const data = useTypedActionData() as { success?: boolean } | undefined;

  return (
    <>
      <AuthCard>
        <PageTitle className="mb-8">Reset your password</PageTitle>
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
