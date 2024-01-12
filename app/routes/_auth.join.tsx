import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { badRequest } from "~/lib/responses.server";
import { SessionService } from "~/services/SessionService.server";
import { UserService } from "~/services/UserService.server";

const validator = withZod(
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
    redirectTo: z.string().optional(),
  }),
);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await SessionService.getUserId(request);
  if (userId) return redirect("/");
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const result = await validator.validate(await request.formData());
  if (result.error) {
    throw badRequest(result.error);
  }

  const { email, password, redirectTo } = result.data;

  const existingUser = await UserService.getByEmail(email);
  if (existingUser) {
    return validationError({
      fieldErrors: {
        email: "An account with this email already exists.",
      },
    });
  }

  const user = await UserService.create(email, password);

  return SessionService.createUserSession({
    request,
    remember: false,
    userId: user.id,
    redirectTo: redirectTo ?? "/",
  });
};

export const meta: MetaFunction = () => [{ title: "Sign Up" }];

export default function Join() {
  const [searchParams] = useSearchParams();

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <ValidatedForm validator={validator} method="post" className="space-y-6">
          <FormField name="email" label="Email" autoComplete="email" />
          <FormField name="password" label="Password" autoComplete="current-password" />

          <input type="hidden" name="redirectTo" value={searchParams.get("redirectTo") ?? ""} />
          <Button className="w-full">Sign Up</Button>
          <div className="flex items-center justify-center">
            <div className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                className="text-blue-500 underline"
                to={{
                  pathname: "/login",
                  search: searchParams.toString(),
                }}
              >
                Log in
              </Link>
            </div>
          </div>
        </ValidatedForm>
      </div>
    </div>
  );
}
