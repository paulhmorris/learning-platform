import type Stripe from "stripe";

let client: Stripe | undefined;

/** Loads the Stripe SDK on first use rather than at boot, since every route module is imported on a cold start. */
export async function getStripe() {
  if (!client) {
    const { default: Stripe } = await import("stripe");
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}
