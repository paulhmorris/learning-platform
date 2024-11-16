import { Outlet, useLoaderData } from "@remix-run/react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { LoaderFunctionArgs, MetaFunction, json } from "@vercel/remix";
import { Theme, useTheme } from "remix-themes";

import { ErrorComponent } from "~/components/error-component";
import { stripe } from "~/integrations/stripe.server";
import { loader as rootLoader } from "~/root";
import { PaymentService } from "~/services/payment.server";
import { SessionService } from "~/services/session.server";

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Payment Methods | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);

  // In case the user doesn't have a Stripe customer, create one
  if (!user.stripeId) {
    const customer = await PaymentService.createCustomer(user.id);
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      customer: customer.stripeId,
    });

    return json({ clientSecret: setupIntent.client_secret ?? undefined });
  }

  const setupIntent = await stripe.setupIntents.create({
    payment_method_types: ["card"],
    customer: user.stripeId,
  });

  return json({ clientSecret: setupIntent.client_secret ?? undefined });
}

const stripePromise = typeof window !== "undefined" ? loadStripe(window.ENV.STRIPE_PUBLIC_KEY) : null;

export default function PaymentMethodsLayout() {
  const { clientSecret } = useLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: theme === Theme.LIGHT ? "stripe" : "night" } }}
    >
      <Outlet />
    </Elements>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
