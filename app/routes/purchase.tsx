import { json, redirect } from "@remix-run/node";

import { PageTitle } from "~/components/common/page-title";
import { stripe } from "~/integrations/stripe.server";

export function loader() {
  return json({});
}

export async function action() {
  const domain = "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 2000,
          product_data: {
            name: "Stubborn Attachments",
            images: ["https://i.imgur.com/EHyR2nP.png"],
          },
        },
      },
    ],
    mode: "payment",
    success_url: `${domain}?success=true`,
    cancel_url: `${domain}?canceled=true`,
  });

  return redirect(session.url ?? "/", { status: 303 });
}

export default function Purchase() {
  return (
    <section>
      <PageTitle>Purchase Course</PageTitle>
      <div className="product">
        <img src="https://i.imgur.com/EHyR2nP.png" alt="The cover of Stubborn Attachments" />
        <div className="description">
          <h3>Stubborn Attachments</h3>
          <h5>$20.00</h5>
        </div>
      </div>
      <form method="post">
        <button type="submit" className="text-purple-800 font-bold">
          Checkout
        </button>
      </form>
    </section>
  );
}
