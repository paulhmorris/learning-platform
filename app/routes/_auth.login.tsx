import { UserRole } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, MetaFunction, redirect, useSearchParams } from "react-router";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { EMAIL_FROM_DOMAIN } from "~/config";
import { EmailService } from "~/integrations/email.server";
import { CheckboxSchema } from "~/lib/schemas";
import { Toasts } from "~/lib/toast.server";
import { safeRedirect } from "~/lib/utils";
import { loader as rootLoader } from "~/root";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, { message: "Password must be 8 or more characters." }),
  remember: CheckboxSchema,
  redirectTo: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  if (userId) {
    throw redirect("/");
  }

  return {};
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await parseFormData(request, schema);

  if (result.error) {
    return validationError(result.error);
  }

  const { email, password, remember, redirectTo } = result.data;
  const user = await AuthService.verifyLogin(email, password);

  if (!user) {
    return validationError({
      fieldErrors: {
        email: "Email or password is incorrect",
      },
    });
  }

  if (!user.isActive) {
    return Toasts.dataWithError(null, {
      message: "Account Deactivated",
      description: "Your account has been deactivated. Please contact support.",
    });
  }

  // If the user is not verified, redirect them to the join page with a message
  if (!user.isEmailVerified) {
    const url = new URL("/join", request.url);
    url.searchParams.set("redirectTo", redirectTo || user.role === UserRole.USER ? "/" : "/admin");
    url.searchParams.set("step", "verify-email");
    url.searchParams.set("email", email);
    url.searchParams.set("status", "unverified");

    const { token } = await AuthService.generateVerificationByEmail(email);
    await EmailService.send({
      from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
      to: user.email,
      subject: "Verify Your Email",
      html: `<p>Here's your six digit verification code: <strong>${token}</strong></p>`,
    });

    return redirect(url.toString());
  }

  return SessionService.createUserSession({
    request,
    userId: user.id,
    redirectTo: safeRedirect(redirectTo, user.role === UserRole.USER ? "/" : "/admin"),
    remember: !!remember,
  });
};

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  return [
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    { title: `Login | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` },
    {
      name: "description",
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      content: `Sign in to your account for ${match?.data?.attributes.title ?? "Plumb Media & Education"}`,
    },
  ];
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/preview";

  return (
    <>
      <AuthCard>
        <PageTitle className="mb-4 sm:mb-8">Sign in</PageTitle>
        <ValidatedForm
          schema={schema}
          defaultValues={{
            email: import.meta.env.DEV ? "paulh.morris@gmail.com" : "",
            password: import.meta.env.DEV ? "password" : "",
          }}
          method="post"
          className="w-full space-y-6"
          noValidate
        >
          {(form) => (
            <>
              <FormField
                scope={form.scope("email")}
                label="Email"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <FormField
                scope={form.scope("password")}
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
            </>
          )}
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
