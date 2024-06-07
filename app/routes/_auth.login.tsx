import { UserRole } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { redirect, typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { Checkbox, FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { Sentry } from "~/integrations/sentry";
import { CheckboxSchema } from "~/lib/schemas";
import { safeRedirect } from "~/lib/utils";
import { verifyLogin } from "~/models/user.server";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

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
  if (!user.isEmailVerified) {
    const url = new URL("/join", request.url);
    url.searchParams.set("redirectTo", redirectTo || user.role === UserRole.USER ? "/" : "/admin");
    url.searchParams.set("step", "verify-email");
    url.searchParams.set("email", email);
    url.searchParams.set("status", "unverified");
    return redirect(url.toString());
  }

  Sentry.setUser({ id: user.id, email: user.email });

  return SessionService.createUserSession({
    request,
    userId: user.id,
    redirectTo: safeRedirect(redirectTo, user.role === UserRole.USER ? "/" : "/admin"),
    remember: !!remember,
  });
};

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Login | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "";

  return (
    <>
      <AuthCard>
        <PageTitle className="mb-8">Sign in</PageTitle>
        <ValidatedForm validator={validator} method="post" className="w-full space-y-6">
          <FormField
            label="Email"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={process.env.NODE_ENV === "development" ? "paul@remix.run" : ""}
          />
          <FormField
            label="Password"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            defaultValue={process.env.NODE_ENV === "development" ? "password" : ""}
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
