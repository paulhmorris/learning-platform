import { Form } from "react-router";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { IconLoader } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function PaymentMethodForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [stripeErrorMessage, setStripeErrorMessage] = useState<string | undefined>();
  const [stripeStatus, setStripeStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    event.preventDefault();

    if (!stripe || !elements) {
      setIsSubmitting(false);
      return null;
    }

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: new URL("/account/payment-methods", window.location.origin).href,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (error) {
      setIsSubmitting(false);
      setStripeErrorMessage(error.message);
    }

    setIsSubmitting(false);
  }

  const isFormDisabled = stripeStatus !== "ready" || !stripe || !elements;

  return (
    <Form onSubmit={handleSubmit} method="post">
      <PaymentElement onReady={() => setStripeStatus("ready")} onLoadError={() => setStripeStatus("error")} />
      {stripeErrorMessage ? (
        <p className="mt-2 rounded border border-destructive bg-destructive/5 p-2 text-sm font-medium text-destructive sm:w-1/2">
          {stripeErrorMessage}
        </p>
      ) : null}
      <Button
        disabled={isFormDisabled || isSubmitting}
        variant="admin"
        className={cn(
          "mt-2 inline-flex items-center gap-2 opacity-100 transition duration-500 disabled:opacity-50 sm:w-auto",
          isFormDisabled && "opacity-0",
        )}
      >
        {isSubmitting ? <IconLoader className="h-4 w-4 animate-spin" /> : null}
        <span>Save Card</span>
      </Button>
    </Form>
  );
}
