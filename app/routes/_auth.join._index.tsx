import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { nanoid } from "nanoid";
import { redirect, typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/page-header";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { verifyEmailJob } from "~/jobs/verify-email.server";
import { SessionService } from "~/services/SessionService.server";
import { UserService } from "~/services/UserService.server";

const validator = withZod(
  z.object({
    firstName: z.string().max(255),
    lastName: z.string().max(255),
    email: z.string().email(),
    password: z.string().min(8).max(64),
    redirectTo: z.string().optional(),
  }),
);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  if (userId) return redirect("/");
  return typedjson({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await validator.validate(await request.formData());

  if (result.error) {
    return validationError(result.error);
  }

  const { firstName, lastName, email, password, redirectTo } = result.data;

  const existingUser = await UserService.getByEmail(email);
  if (existingUser) {
    return validationError({
      fieldErrors: {
        email: "An account with this email already exists.",
      },
    });
  }

  const user = await UserService.create(email, password, {
    data: { firstName, lastName },
  });

  await verifyEmailJob.invoke({ email: user.email }, { idempotencyKey: nanoid() });

  const url = new URL("/join/verify-email", request.url);
  url.searchParams.set("email", user.email);
  if (redirectTo) {
    url.searchParams.set("redirectTo", redirectTo);
  }

  return redirect(url.toString());
};

export const meta: MetaFunction = () => [{ title: "Sign Up" }];

export default function Join() {
  const [searchParams] = useSearchParams();

  return (
    <>
      <PageTitle className="text-center">Register for an account</PageTitle>
      <AuthCard>
        <ValidatedForm validator={validator} method="post" className="w-full space-y-8">
          <div className="grid grid-cols-2 gap-2">
            <FormField required name="firstName" label="First Name" autoComplete="given-name" maxLength={255} />
            <FormField required name="lastName" label="Last Name" autoComplete="family-name" maxLength={255} />
            <input type="hidden" name="redirectTo" value={searchParams.get("redirectTo") ?? ""} />
          </div>
          <FormField required name="email" label="Email" autoComplete="email" />
          <FormField
            required
            name="password"
            type="password"
            label="Password"
            autoComplete="new-password"
            maxLength={64}
          />
          <div>
            <SubmitButton variant="primary-md">Sign Up</SubmitButton>
            <p className="mt-1 text-center text-sm text-muted-foreground contrast-more:text-foreground">
              You will be receive a code to verify your account.
            </p>
          </div>
        </ValidatedForm>
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
