import { conform } from "@conform-to/react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import { Field, useForm } from "~/components/ui/form";
import { badRequest } from "~/lib/responses.server";
import { createUserSession, getUserId } from "~/lib/session.server";
import { parseForm } from "~/lib/utils";
import { createUser, getUserByEmail } from "~/models/user.server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z.string().optional(),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const submission = await parseForm({ request, schema });

  if (submission.intent !== "submit") {
    return json(submission);
  }

  const { email, password, redirectTo } = submission.value;

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw badRequest({
      ...submission,
      error: {
        email: ["A user already exists with this email. Please log in."],
      },
    });
  }

  const user = await createUser(email, password);

  return createUserSession({
    request,
    remember: false,
    userId: user.id,
    redirectTo: redirectTo ?? "/",
  });
};

export const meta: MetaFunction = () => [{ title: "Sign Up" }];

export default function Join() {
  const [searchParams] = useSearchParams();
  const lastSubmission = useActionData<typeof action>();
  const [form, { email, password, redirectTo }] = useForm({
    lastSubmission,
    schema,
    shouldRevalidate: "onSubmit",
    defaultValue: {
      redirectTo: searchParams.get("redirectTo") || "/",
    },
  });

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <Form method="post" className="space-y-6" {...form.props}>
          <Field label="Email" autoComplete="email" {...conform.input(email, { type: "email" })} errors={email.errors} />
          <Field label="Password" autoComplete="current-password" {...conform.input(password, { type: "password" })} errors={password.errors} />

          <input {...conform.input(redirectTo, { hidden: true })} />
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
        </Form>
      </div>
    </div>
  );
}
