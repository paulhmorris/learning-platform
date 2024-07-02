import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, MetaFunction, useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { useStripe } from "@stripe/react-stripe-js";
import { IconLoader, IconPlus } from "@tabler/icons-react";
import { useEffect } from "react";
import { toast as clientToast } from "sonner";

import { ErrorComponent } from "~/components/error-component";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { db } from "~/integrations/db.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { serverError } from "~/lib/responses.server";
import { toast } from "~/lib/toast.server";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);

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
    return json({ methods: null, stripeCustomer });
  }

  const methods = await stripe.customers.listPaymentMethods(user.stripeId);
  const stripeCustomer = await stripe.customers.retrieve(user.stripeId);

  if (stripeCustomer.deleted) {
    Sentry.captureMessage("A deleted Stripe customer attempted to access payment methods.", { level: "info" });
    throw serverError("Error retrieving payment methods. Please contact support.");
  }

  return json({ methods, stripeCustomer });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await SessionService.requireUser(request);

  if (!user.stripeId) {
    return toast.json(
      request,
      { ok: false },
      {
        title: "Error",
        type: "error",
        description: "Error retrieving your payment profile. Please contact support.",
      },
      { status: 404 },
    );
  }

  const formData = Object.fromEntries(await request.formData());
  const _action = formData._action as "delete" | "set_default";
  const id = formData.id as string;

  try {
    if (_action === "delete") {
      await stripe.paymentMethods.detach(id);
      return toast.json(
        request,
        { ok: true },
        { title: "Success", type: "success", description: "Payment method has been deleted successfully." },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (_action === "set_default") {
      await stripe.customers.update(user.stripeId, {
        invoice_settings: { default_payment_method: id },
      });
      return toast.json(
        request,
        { ok: true },
        { title: "Success", type: "success", description: "Payment method has been set as default." },
      );
    }
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return toast.json(
      request,
      { ok: false },
      { title: "Unknown Error", type: "error", description: "There was an error updating your payment method." },
    );
  }
}

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `Payment Methods | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
};

export default function PaymentMethodsIndex() {
  const fetcher = useFetcher();
  const stripe = useStripe();
  const { methods, stripeCustomer } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const isBusy = fetcher.state !== "idle";

  // Inspect Stripe setupIntent status
  useEffect(() => {
    if (!stripe) {
      return;
    }
    const clientSecret = searchParams.get("setup_intent_client_secret");

    if (!clientSecret) {
      return;
    }

    void stripe.retrieveSetupIntent(clientSecret).then(({ setupIntent }) => {
      switch (setupIntent?.status) {
        case "succeeded":
          clientToast.success("Success! Your payment method has been saved.");
          break;

        case "processing":
          clientToast.info("Processing payment details. We'll update you when processing is complete.");
          break;

        case "requires_payment_method":
          clientToast.error("Failed to process payment details. Please try another payment method.");
          break;
      }
    });
  }, [stripe, searchParams]);

  return (
    <>
      {methods ? (
        <ul className="space-y-2">
          {methods.data.map((m) => {
            const isDefault = stripeCustomer.invoice_settings.default_payment_method === m.id;
            if (m.type === "card" && m.card) {
              return (
                <li key={m.id} className="flex justify-between rounded-md border px-4 py-3">
                  <div>
                    <p className="flex items-center gap-2 text-base font-semibold">
                      <span>
                        <span className="capitalize">{m.card.brand}</span> ending in {m.card.last4}
                      </span>
                      {isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expires {`${m.card.exp_month > 9 ? "" : "0"}${m.card.exp_month}/${m.card.exp_year}`}
                    </p>
                  </div>
                  <fetcher.Form
                    className="flex items-center gap-2"
                    method="post"
                    action="/account/payment-methods?index"
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="inline-flex gap-2 rounded-md border px-2 py-1.5 text-xs font-medium shadow-sm transition hover:border-destructive hover:bg-destructive/5 hover:text-destructive focus-visible:bg-destructive/5 focus-visible:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:opacity-50"
                      name="_action"
                      value="delete"
                      disabled={isBusy}
                    >
                      {isBusy ? <IconLoader className="h-4 w-4 animate-spin" /> : null}
                      <span>Delete</span>
                    </button>
                    {!isDefault ? (
                      <button
                        type="submit"
                        className="inline-flex gap-2 rounded-md border px-2 py-1.5 text-xs font-medium shadow-sm transition hover:bg-secondary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                        name="_action"
                        value="set_default"
                        disabled={isBusy}
                      >
                        {isBusy ? <IconLoader className="h-4 w-4 animate-spin" /> : null}
                        <span>Set Default</span>
                      </button>
                    ) : null}
                  </fetcher.Form>
                </li>
              );
            }
          })}
        </ul>
      ) : null}
      <Button variant="admin" asChild className="mt-8 sm:w-auto">
        <Link to="/account/payment-methods/new">
          <IconPlus className="size-5" />
          <span>Add Card</span>
        </Link>
      </Button>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
