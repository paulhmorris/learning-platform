import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { redirect, typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { ErrorComponent } from "~/components/error-component";
import { PageTitle } from "~/components/page-title";
import { Checkbox, FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { Sentry } from "~/integrations/sentry";
import { META } from "~/lib/constants";
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

  // If the user is not verified, redirect them to the join page with a message
  if (!user.isVerified) {
    const url = new URL("/join", request.url);
    url.searchParams.set("redirectTo", redirectTo || "/");
    url.searchParams.set("step", "verify-email");
    url.searchParams.set("email", email);
    url.searchParams.set("status", "unverified");
    return redirect(url.toString());
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
    <>
      <PageTitle className="text-center">Sign in to your account</PageTitle>
      <AuthCard>
        <ValidatedForm validator={validator} method="post" className="w-full space-y-8">
          <FormField label="Email" id="email" name="email" type="email" autoComplete="email" required />
          <FormField
            label="Password"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          <div className="flex items-center justify-between gap-x-2">
            <div className="flex items-center gap-x-2">
              <Checkbox id="remember" name="remember" aria-labelledby="remember-label" />
              <Label id="remember-label" htmlFor="remember" className="cursor-pointer">
                Stay logged in
              </Label>
            </div>
            <Link className="inline-block text-sm font-bold" to="/passwords/reset">
              Forgot Password?
            </Link>
            <input type="hidden" name="redirectTo" value={redirectTo} />
          </div>
          <SubmitButton variant="primary-md">Log in</SubmitButton>
        </ValidatedForm>
      </AuthCard>
      <p className="text-center text-sm">
        Want to sign up for an account?{" "}
        <Link to={{ pathname: "/join", search: searchParams.toString() }} className="text-sm font-bold">
          Sign up.
        </Link>
      </p>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
