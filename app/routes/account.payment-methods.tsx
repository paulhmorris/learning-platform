import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Theme, useTheme } from "remix-themes";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { ErrorComponent } from "~/components/error-component";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { serverError } from "~/lib/responses.server";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `Payment Methods | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);

  try {
    // In case the user doesn't have a Stripe customer, create one
    if (!user.stripeId) {
      const stripeCustomer = await stripe.customers.create({
        name: `${user.firstName}${user.lastName ? " " + user.lastName : ""}`,
        email: user.email,
        phone: user.phone ?? undefined,
        metadata: {
          user_id: user.id,
        },
      });
      await db.user.update({
        where: { id: user.id },
        data: { stripeId: stripeCustomer.id },
      });
    }

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

const stripePromise = typeof window !== "undefined" ? loadStripe(window.ENV.STRIPE_PUBLIC_KEY) : null;

export default function PaymentMethodsLayout() {
  const { clientSecret } = useTypedLoaderData<typeof loader>();
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
