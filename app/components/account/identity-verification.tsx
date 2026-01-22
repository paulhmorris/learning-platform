import { loadStripe, Stripe } from "@stripe/stripe-js";
import { IconCircleCheckFilled, IconExclamationCircle, IconFileSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useRevalidator } from "react-router";
import { toast } from "sonner";

import { AdminButton } from "~/components/ui/admin-button";
import { Sentry } from "~/integrations/sentry";
import { VerificationSession } from "~/services/identity.server";

const stripePromise = typeof window !== "undefined" ? loadStripe(window.ENV.STRIPE_PUBLIC_KEY) : null;

export function IdentityVerification({
  session,
  isIdentityVerified,
}: {
  session: VerificationSession | null;
  isIdentityVerified: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!stripePromise) return;
    async function loadStripe() {
      setStripe(await stripePromise);
    }
    void loadStripe();
  }, []);

  async function handleStartVerification() {
    if (!stripe) return;

    try {
      const response = await fetch("/api/identity-verification", { method: "POST" });
      if (!response.ok) {
        return toast.error("A server error occurred while trying to verify your identity.");
      }

      const json = (await response.json()) as { client_secret: string };
      const client_secret = json.client_secret;
      if (!client_secret) {
        Sentry.captureMessage("No client secret returned from identity verification creation");
        return toast.error("An error occurred while trying to verify your identity.");
      }

      const { error } = await stripe.verifyIdentity(client_secret);
      if (error) {
        Sentry.captureException(error);
        return toast.error("An error occurred while trying to verify your identity.");
      }

      setSubmitted(true);
      toast.success("Thanks for submitting your documents.", { description: "We are processing your verification" });
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      toast.error("An error occurred while trying to verify your identity.");
    } finally {
      void revalidator.revalidate();
    }
  }

  const status = session?.status;
  const code = session?.last_error?.code;
  const errorReason = session?.last_error?.reason;

  if (isIdentityVerified || status === "verified") {
    return (
      <Wrapper>
        <div className="mt-2 flex items-center gap-2">
          <IconCircleCheckFilled className="size-6 text-success" />
          <p className="text-sm font-bold">Verified</p>
        </div>
      </Wrapper>
    );
  }

  if (submitted || status === "processing") {
    return (
      <Wrapper>
        <div className="mt-2 flex items-center gap-2">
          <IconFileSearch />
          <p className="text-sm">
            Your identity verification is in progress. You will receive an email with the results once it has processed.
          </p>
        </div>
      </Wrapper>
    );
  }

  if (status === "requires_input" && code !== "consent_declined" && code !== "abandoned" && errorReason) {
    return (
      <Wrapper>
        <div className="mt-2 flex items-center gap-2">
          <IconExclamationCircle className="size-5 shrink-0 text-destructive" />
          <p className="text-sm">
            There was an error processing your identity verification:{" "}
            <strong className="text-destructive">{errorReason}</strong> Please reach out to support for manual
            verification.
          </p>
        </div>
      </Wrapper>
    );
  }

  if (!session || status === "requires_input") {
    return (
      <Wrapper>
        <p className="mb-4 text-xs text-muted-foreground" id="verify-btn-description">
          This is required to complete some courses. If you have purchased a course that requires identity verification,
          you must complete this process before you can receive a certificate.
        </p>
        <AdminButton
          onClick={handleStartVerification}
          disabled={!stripe}
          type="button"
          className="w-auto text-foreground sm:h-8 sm:text-xs"
          aria-describedby="verify-btn-description"
        >
          <span>Verify Me</span>
        </AdminButton>
      </Wrapper>
    );
  }
  return null;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2">
      <h2 className="text-lg font-semibold">Identity Verification</h2>
      {children}
    </div>
  );
}
