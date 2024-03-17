import { LoaderFunctionArgs } from "@remix-run/node";
import { Form } from "@remix-run/react";
import { Elements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useState } from "react";
import { Theme, useTheme } from "remix-themes";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { Button } from "~/components/ui/button";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { serverError } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUserId(request);

  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
    });

    return typedjson({ clientSecret: setupIntent.client_secret ?? undefined });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw serverError("Error creating payment method setup intent. Please try again.");
  }
}

const stripePromise = loadStripe(
  "pk_test_51Ib91QJWTi6PPwsmiWbJ728vvzlL6EVg5YO8je1ENBZn1OqBpCDs9pyPbXKGiDegPnkjmOBmL0g1G2KxKQm6tbdP00KtI9BK07",
);

export default function NewPaymentMethod() {
  const [stripeStatus, setStripeStatus] = useState<"loading" | "ready" | "error">("loading");
  const { clientSecret } = useTypedLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: theme === Theme.LIGHT ? "stripe" : "night" } }}
    >
      <Form>
        <PaymentElement onReady={() => setStripeStatus("ready")} onLoadError={() => setStripeStatus("error")} />
        <Button
          disabled={stripeStatus !== "ready"}
          variant="primary-md"
          className={cn(
            "mt-2 opacity-100 transition duration-200 disabled:opacity-0",
            stripeStatus !== "ready" && "opacity-0",
          )}
        >
          Add Card
        </Button>
      </Form>
    </Elements>
  );
}
