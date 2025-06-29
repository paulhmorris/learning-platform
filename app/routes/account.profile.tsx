import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { z } from "zod";

import { IdentityVerification } from "~/components/account/identity-verification";
import { ErrorComponent } from "~/components/error-component";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { Toasts } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/session.server";
import { UserService } from "~/services/user.server";

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Profile | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

const schema = z.object({
  id: z.string().cuid(),
  firstName: z.string().max(255),
  lastName: z.string().max(255),
  email: z.string().email(),
  phone: z.string().max(20),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  let session = null;
  if (user.stripeVerificationSessionId) {
    session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
  }

  return { identitySession: session };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { id, ...rest } = result.data;

  // Ensure the user is updating their own account
  if (id !== user.id) {
    return Toasts.dataWithError(
      { message: "You are not authorized to perform this action." },
      {
        message: "Unauthorized",
        description: "You are not authorized to perform this action.",
      },
      { status: 403 },
    );
  }

  try {
    const updatedUser = await UserService.update(user.id, rest);
    return Toasts.dataWithSuccess(
      { updatedUser },
      {
        message: "Account Updated",
        description: "Your account has been updated successfully.",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(
      { message: "An error occurred while updating your account." },
      { message: "Unknown Error", description: "An error occurred while updating your account." },
    );
  }
}

export default function AccountProfile() {
  const user = useUser();

  return (
    <div className="space-y-8">
      <IdentityVerification />
      <ValidatedForm
        method="post"
        action="/account/profile"
        schema={schema}
        defaultValues={{
          id: user.id,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email,
          phone: user.phone ?? "",
        }}
      >
        {(form) => (
          <>
            <input type="hidden" name="id" value={user.id} />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  scope={form.scope("firstName")}
                  required
                  name="firstName"
                  label="First Name"
                  autoComplete="given-name"
                  maxLength={255}
                />
                <FormField
                  scope={form.scope("lastName")}
                  required
                  name="lastName"
                  label="Last Name"
                  autoComplete="family-name"
                  maxLength={255}
                />
              </div>
              <FormField
                scope={form.scope("email")}
                required
                name="email"
                label="Email"
                type="email"
                autoComplete="email"
                maxLength={255}
              />
              <FormField
                scope={form.scope("phone")}
                name="phone"
                label="Phone"
                type="tel"
                autoComplete="tel"
                maxLength={20}
              />
              <SubmitButton variant="admin" className="sm:w-auto">
                Save
              </SubmitButton>
            </div>
          </>
        )}
      </ValidatedForm>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
