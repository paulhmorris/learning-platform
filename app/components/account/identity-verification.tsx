import { useLoaderData, useRevalidator } from "@remix-run/react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { IconCircleCheckFilled, IconExclamationCircle, IconFileSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Sentry } from "~/integrations/sentry";
import { useUser } from "~/lib/utils";
import { loader } from "~/routes/account.profile";

const stripePromise = typeof window !== "undefined" ? loadStripe(window.ENV.STRIPE_PUBLIC_KEY) : null;

export function IdentityVerification() {
  const user = useUser();
  const [submitted, setSubmitted] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const { identitySession } = useLoaderData<typeof loader>();
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
        return toast.error("A server occurred while trying to verify your identity.");
      }

      const { client_secret } = (await response.json()) as { client_secret: string };
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
      revalidator.revalidate();
    }
  }

  const status = identitySession?.status;
  const code = identitySession?.last_error?.code;
  const errorReason = identitySession?.last_error?.reason;

  if (user.isIdentityVerified || status === "verified") {
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

  if (!identitySession || status === "requires_input") {
    return (
      <Wrapper>
        <p className="mb-4 text-xs text-muted-foreground" id="verify-btn-description">
          This is required to complete some courses. If you have purchased a course that requires identity verification,
          you must complete this process before you can receive a certificate.
        </p>
        <Button
          onClick={handleStartVerification}
          disabled={!stripe}
          type="button"
          className="h-8 w-auto bg-muted text-xs text-foreground"
          aria-describedby="verify-btn-description"
          variant="admin"
        >
          <span>Verify Me</span>
        </Button>
      </Wrapper>
    );
  }
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border px-4 py-2">
      <h2 className="text-lg font-semibold">Identity Verification</h2>
      {children}
    </div>
  );
}