import { LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { PageTitle } from "~/components/common/page-title";
import { Button } from "~/components/ui/button";
import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const course = await db.course.findUniqueOrThrow({
    where: { host: url.host },
  });

  const product = await stripe.products.retrieve("prod_QFenLoxmawFmBo");
  if (!product.default_price) {
    throw new Error("Product has no default price");
  }

  const price = await stripe.prices.retrieve(product.default_price as string);
  return json({ course, product, price });
}

export async function action() {
  const domain = "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: "price_1PP9UMJWTi6PPwsmDAPQTHvh", quantity: 1 }],
    mode: "payment",
    success_url: `${domain}/purchase?success=true`,
    cancel_url: `${domain}/purchase?canceled=true`,
  });

  return redirect(session.url ?? "/", { status: 303 });
}

export default function Purchase() {
  const { product, price } = useLoaderData<typeof loader>();
  const formattedPrice = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
  }).format(price.unit_amount ? price.unit_amount / 100 : 0);

  return (
    <main className="mx-auto grid size-full max-w-screen-lg place-items-center px-4 lg:px-0">
      <div className="space-y-5">
        <div className="flex max-h-96 justify-center overflow-hidden rounded-lg border">
          <img src={product.images[0]} alt="" className="object-cover" />
        </div>
        <PageTitle>{product.name}</PageTitle>
        <p className="text-2xl font-bold">{formattedPrice}</p>
        <p className="text-muted-foreground">{product.description}</p>
        <form method="post">
          <Button variant="primary" type="submit" className="px-20 sm:w-auto">
            Enroll Now
          </Button>
        </form>
      </div>
    </main>
  );
}
