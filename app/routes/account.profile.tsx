import { withZod } from "@remix-validated-form/with-zod";
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, json } from "@vercel/remix";
import { ValidatedForm, validationError } from "remix-validated-form";
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

const validator = withZod(
  z.object({
    id: z.string().cuid(),
    firstName: z.string().max(255),
    lastName: z.string().max(255),
    email: z.string().email(),
    phone: z.string().max(20),
  }),
);

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  let session = null;
  if (user.stripeVerificationSessionId) {
    session = await stripe.identity.verificationSessions.retrieve(user.stripeVerificationSessionId);
  }

  return json({ identitySession: session });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { id, ...rest } = result.data;

  // Ensure the user is updating their own account
  if (id !== user.id) {
    return Toasts.jsonWithError(
      { message: "You are not authorized to perform this action." },
      {
        title: "Unauthorized",
        description: "You are not authorized to perform this action.",
      },
      { status: 403 },
    );
  }

  try {
    const updatedUser = await UserService.update(user.id, rest);
    return Toasts.jsonWithSuccess(
      { updatedUser },
      {
        title: "Account Updated",
        description: "Your account has been updated successfully.",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.jsonWithError(
      { message: "An error occurred while updating your account." },
      { title: "Unknown Error", description: "An error occurred while updating your account." },
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
        validator={validator}
        defaultValues={{
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email,
        }}
      >
        <input type="hidden" name="id" value={user.id} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <FormField required name="firstName" label="First Name" autoComplete="given-name" maxLength={255} />
            <FormField required name="lastName" label="Last Name" autoComplete="family-name" maxLength={255} />
          </div>
          <FormField required name="email" label="Email" type="email" autoComplete="email" maxLength={255} />
          <FormField name="phone" label="Phone" type="tel" autoComplete="tel" maxLength={20} />
          <SubmitButton variant="admin" className="sm:w-auto">
            Save
          </SubmitButton>
        </div>
      </ValidatedForm>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
