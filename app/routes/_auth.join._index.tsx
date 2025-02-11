import { Link, MetaFunction, useFetcher, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { useEffect } from "react";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/common/page-title";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { EMAIL_FROM_DOMAIN } from "~/config";
import { EmailService } from "~/integrations/email.server";
import { Toasts } from "~/lib/toast.server";
import { loader as rootLoader } from "~/root";
import { validator as verifyCodeValidator } from "~/routes/api.verification-code";
import { AuthService } from "~/services/auth.server";
import { SessionService } from "~/services/session.server";
import { UserService } from "~/services/user.server";

const validator = withZod(
  z.discriminatedUnion("step", [
    z.object({
      step: z.literal("join"),
      firstName: z.string().max(255),
      lastName: z.string().max(255),
      email: z.string().email(),
      phone: z.string().optional(),
      password: z.string().min(8).max(64),
      redirectTo: z.string().optional(),
    }),
    z.object({
      step: z.literal("verify-email"),
      email: z.string().email(),
      code: z.string().length(6),
      redirectTo: z.string().optional(),
    }),
  ]),
);

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

  if (result.data.step === "join") {
    const { firstName, lastName, email, password, redirectTo } = result.data;
    const existingUser = await UserService.exists(email);
    if (existingUser) {
      return validationError({
        fieldErrors: {
          email: "An account with this email already exists.",
        },
      });
    }

    const user = await UserService.create(email, password, { firstName, lastName });
    const verification = await AuthService.generateVerificationById(user.id);

    await EmailService.send({
      from: `Plumb Media & Education <no-reply@${EMAIL_FROM_DOMAIN}>`,
      to: user.email,
      subject: "Verify Your Email",
      html: `<p>Here's your six digit verification code: <strong>${verification.token}</strong></p>`,
    });

    const url = new URL("/join", request.url);
    url.searchParams.set("step", "verify-email");
    url.searchParams.set("email", email);
    if (redirectTo) {
      url.searchParams.set("redirectTo", redirectTo);
    }

    return redirect(url.toString());
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (result.data.step === "verify-email") {
    const { email, code, redirectTo } = result.data;
    const user = await UserService.getByEmail(email);
    if (!user) {
      return validationError({
        fieldErrors: {
          email: "An account with this email does not exist.",
        },
      });
    }

    const verification = await AuthService.getVerificationByUserId(user.id);

    if (!verification || verification.token !== code) {
      return validationError({
        fieldErrors: {
          code: "The code you entered is incorrect.",
        },
      });
    }

    await UserService.update(user.id, {
      isEmailVerified: true,
      verification: {
        update: { expiresAt: new Date() },
      },
    });

    return SessionService.createUserSession({
      request,
      userId: user.id,
      redirectTo: redirectTo ?? "/preview",
      remember: false,
    });
  }

  return Toasts.jsonWithError(
    { message: "Invalid step" },
    { title: "Something went wrong", description: "Please try again." },
  );
};

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Join | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export default function Join() {
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher();

  const status = searchParams.get("status");
  const email = searchParams.get("email");
  const step = searchParams.get("step");

  useEffect(() => {
    // We need to go back to the first step in case we lose the email param
    if (step === "verify-email" && !email) {
      const url = new URL("/join", window.location.href);
      url.searchParams.set("step", "join");
      window.location.replace(url.toString());
    }
  }, [status, email, step]);

  return (
    <>
      <AuthCard>
        <PageTitle className="mb-8">{status === "unverified" ? "Verify Your Account" : "Register"}</PageTitle>
        {step === "verify-email" ? (
          <>
            <p>Please enter the six digit verification code sent to {email}.</p>
            <ValidatedForm
              fetcher={fetcher}
              validator={verifyCodeValidator}
              method="post"
              action="/api/verification-code"
              className="mb-8"
            >
              <input type="hidden" name="email" value={email ?? ""} />
              <button
                type="submit"
                className="text-sm text-muted-foreground underline decoration-2 underline-offset-2 hover:text-foreground"
              >
                Request new code
              </button>
            </ValidatedForm>
            <ValidatedForm validator={validator} method="post" className="w-full space-y-4">
              <input type="hidden" name="email" value={email ?? ""} />
              <FormField key="code" id="code" label="Code" name="code" autoComplete="one-time-code" required />
              <SubmitButton name="step" value="verify-email" variant="primary-md">
                Verify Email
              </SubmitButton>
            </ValidatedForm>
          </>
        ) : (
          <ValidatedForm validator={validator} method="post" className="w-full space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <FormField required name="firstName" label="First Name" autoComplete="given-name" maxLength={255} />
              <FormField required name="lastName" label="Last Name" autoComplete="family-name" maxLength={255} />
              <input type="hidden" name="redirectTo" value={searchParams.get("redirectTo") ?? ""} />
            </div>
            <FormField name="phone" label="Phone Number" autoComplete="tel" inputMode="tel" maxLength={15} />
            <FormField
              required
              id="email"
              key="email"
              type="email"
              name="email"
              label="Email"
              autoComplete="email"
              maxLength={255}
            />
            <FormField
              required
              name="password"
              type="password"
              label="Password"
              autoComplete="new-password"
              maxLength={64}
            />
            <div>
              <SubmitButton name="step" value="join" variant="primary-md">
                Sign Up
              </SubmitButton>
              <p className="mt-1.5 text-center text-sm text-muted-foreground contrast-more:text-foreground">
                You will receive a code to verify your account.
              </p>
            </div>
          </ValidatedForm>
        )}
      </AuthCard>
      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link className="text-sm font-bold" to={{ pathname: "/login", search: searchParams.toString() }}>
          Log in
        </Link>
      </p>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
