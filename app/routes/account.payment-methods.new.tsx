import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";
import { Elements, PaymentElement } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { IconArrowLeft } from "@tabler/icons-react";
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
  const user = await SessionService.requireUser(request);

  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      customer: user.stripeId ?? undefined,
    });

    return typedjson({ clientSecret: setupIntent.client_secret ?? undefined });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw serverError("Error creating payment method setup intent. Please try again.");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);
  if (user.stripeId) {
    const stripeCustomer = await stripe.customers.create({
      name: `${user.firstName}${user.lastName ? " " + user.lastName : ""}`,
      email: user.email,
      phone: user.phone ?? undefined,
      metadata: {
        userId: user.id,
      },
    });
  }
}

const stripePromise = typeof window !== "undefined" ? loadStripe(window.ENV.STRIPE_PUBLIC_KEY) : null;

export default function NewPaymentMethod() {
  const [stripeStatus, setStripeStatus] = useState<"loading" | "ready" | "error">("loading");
  const { clientSecret } = useTypedLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <>
      <Link to="/account/payment-methods" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <IconArrowLeft className="size-4" />
        <span>Back to payment methods</span>
      </Link>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: { theme: theme === Theme.LIGHT ? "stripe" : "night" } }}
      >
        <Form method="post" action="/account/payment-methods/new">
          <PaymentElement onReady={() => setStripeStatus("ready")} onLoadError={() => setStripeStatus("error")} />
          <Button
            disabled={stripeStatus !== "ready"}
            variant="admin"
            className={cn(
              "mt-2 opacity-100 transition duration-500 disabled:opacity-0 sm:w-auto",
              stripeStatus !== "ready" && "opacity-0",
            )}
          >
            Add Card
          </Button>
        </Form>
      </Elements>
    </>
  );
}
