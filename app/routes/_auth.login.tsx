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
import { verifyLogin } from "~/models/user.server";

export const meta: MetaFunction = () => [{ title: "Login" }];

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  redirectTo: z.string().optional(),
  remember: z.literal("on").optional(),
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

  const { email, password, remember, redirectTo } = submission.value;
  const user = await verifyLogin(email, password);

  if (!user) {
    throw badRequest({
      ...submission,
      error: {
        "": ["Invalid email or password"],
      },
    });
  }

  return createUserSession({
    request,
    userId: user.id,
    redirectTo: redirectTo || "/",
    remember: remember === "on" ? true : false,
  });
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const lastSubmission = useActionData<typeof action>();
  const [form, { email, password, redirectTo, remember }] = useForm({
    lastSubmission,
    schema,
    shouldRevalidate: "onSubmit",
    defaultValue: {
      redirectTo: searchParams.get("redirectTo") || "/",
    },
  });

  // useEffect(() => {
  //   console.log("lastSubmission", lastSubmission);
  //   console.log("email", email);
  // }, [lastSubmission, email]);

  return (
    <div className="flex min-h-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <Form method="post" {...form.props}>
          <Field label="Email" autoComplete="email" {...conform.input(email, { type: "email" })} errors={email.errors} />
          <Field label="Password" autoComplete="current-password" {...conform.input(password, { type: "password" })} errors={password.errors} />

          <input {...conform.input(redirectTo, { hidden: true })} />
          <Button className="w-full">Log in</Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input id="remember" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" {...conform.input(remember, { type: "checkbox" })} />
              <label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>
            <div className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                className="text-blue-500 underline"
                to={{
                  pathname: "/join",
                  search: searchParams.toString(),
                }}
              >
                Sign up
              </Link>
            </div>
          </div>
          <p className="text-sm font-semibold text-destructive">{form.error}</p>
        </Form>
      </div>
    </div>
  );
}
