import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { redirect, typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { ErrorComponent } from "~/components/error-component";
import { PageTitle } from "~/components/page-header";
import { Checkbox, FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { META } from "~/config";
import { Sentry } from "~/integrations/sentry";
import { CheckboxSchema } from "~/lib/schemas";
import { safeRedirect } from "~/lib/utils";
import { verifyLogin } from "~/models/user.server";
import { SessionService } from "~/services/SessionService.server";

const validator = withZod(
  z.object({
    email: z.string().email(),
    password: z.string().min(8, { message: "Password must be 8 or more characters." }),
    remember: CheckboxSchema,
    redirectTo: z.string().optional(),
  }),
);

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

  const { email, password, remember, redirectTo } = result.data;
  const user = await verifyLogin(email, password);

  if (!user) {
    return validationError({
      fieldErrors: {
        email: "Email or password is incorrect",
      },
    });
  }

  Sentry.setUser({ id: user.id, email: user.email });

  return SessionService.createUserSession({
    request,
    userId: user.id,
    redirectTo: safeRedirect(redirectTo, "/"),
    remember: !!remember,
  });
};

export const meta: MetaFunction = () => [{ title: `Login | ${META.titleSuffix}` }];

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  return (
    <div>
      <PageTitle>Sign in to your account</PageTitle>
      <ValidatedForm validator={validator} method="post" className="mt-4 w-full space-y-4">
        <FormField label="Email" id="email" name="email" type="email" autoComplete="email" required />
        <FormField
          label="Password"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />

        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center space-x-2">
            <Checkbox id="remember" name="remember" aria-labelledby="remember-label" />
            <Label id="remember-label" htmlFor="remember">
              Stay logged in for 30 days
            </Label>
          </div>
          <Link className="text-sm font-bold" to="/passwords/reset">
            Forgot Password?
          </Link>
        </div>
        <SubmitButton className="w-full">Log in</SubmitButton>
        <p className="text-sm">
          Want to sign up for an account? <Link to="/join">Sign up.</Link>
        </p>
      </ValidatedForm>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
