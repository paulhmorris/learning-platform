import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import { Stripe, loadStripe } from "@stripe/stripe-js";
import { IconExclamationCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { typedjson } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { toast as clientToast } from "sonner";
import { z } from "zod";

import { ErrorComponent } from "~/components/error-component";
import { IconCheck } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { toast } from "~/lib/toast.server";
import { useUser } from "~/lib/utils";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

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
  await SessionService.requireUserId(request);
  return typedjson({});
}

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Profile | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { id, ...rest } = result.data;

  // Ensure the user is updating their own account
  if (id !== user.id) {
    return toast.json(
      request,
      { message: "You are not authorized to perform this action." },
      {
        title: "Unauthorized",
        description: "You are not authorized to perform this action.",
        type: "error",
      },
      { status: 403 },
    );
  }

  try {
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { ...rest },
    });
    return toast.json(
      request,
      { updatedUser },
      {
        title: "Account Updated",
        description: "Your account has been updated successfully.",
        type: "success",
      },
    );
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.json(
      request,
      { message: "An error occurred while updating your account." },
      {
        title: "Unknown Error",
        description: "An error occurred while updating your account.",
        type: "error",
      },
    );
  }
}

const stripePromise = typeof window !== "undefined" ? loadStripe(window.ENV.STRIPE_PUBLIC_KEY) : null;

export default function AccountProfile() {
  const user = useUser();
  const [stripe, setStripe] = useState<Stripe | null>(null);

  useEffect(() => {
    if (!stripePromise) return;

    async function loadStripe() {
      setStripe(await stripePromise);
    }
    void loadStripe();
  }, []);

  async function handleVerify() {
    if (!stripe) return;

    try {
      const response = await fetch("/api/identity-verification", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to create a verification session.");
      }

      const { client_secret } = (await response.json()) as { client_secret: string };
      const { error } = await stripe.verifyIdentity(client_secret);
      if (error) {
        Sentry.captureException(error);
        clientToast.error("An error occurred while verifying your identity.");
      } else {
        clientToast.info("We're processing your identity verification. You'll receive an email with the results.");
      }
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      clientToast.error("An error occurred while trying to verify your identity.");
    }
  }

  return (
    <div>
      <div className="mb-8">
        {!user.isIdentityVerified && !user.stripeVerificationSessionId ? (
          <>
            <Button
              onClick={handleVerify}
              disabled={!stripe}
              type="button"
              className="text-sm text-foreground sm:w-auto"
              aria-describedby="verify-btn-description"
              variant="link"
            >
              <IconExclamationCircle className="size-5" />
              <span>Verify My Identity</span>
            </Button>
            <p className="text-xs text-muted-foreground" id="verify-btn-description">
              This is required to complete a driver safety course.
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <IconCheck className="size-5 text-success" />
            <p className="text-sm">Identity Verified</p>
          </div>
        )}
      </div>
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
          <FormField required name="email" label="Email" type="email" autoComplete="email" />
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
