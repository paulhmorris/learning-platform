import { useLoaderData, useSearchParams } from "@remix-run/react";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@vercel/remix";
import { useEffect, useState } from "react";

import { PageTitle } from "~/components/common/page-title";
import { PurchaseCanceledModal } from "~/components/purchase-canceled-modal";
import { PurchaseSuccessModal } from "~/components/purchase-success-modal";
import { Button } from "~/components/ui/button";
import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";
import { SessionService } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await SessionService.getUserId(request);
  const url = new URL(request.url);
  const course = await db.course.findUniqueOrThrow({
    where: { host: url.host },
  });

  // User already has access to this course
  if (userId) {
    const userCourses = await db.userCourses.findMany({
      where: { userId, courseId: course.id },
    });
    if (userCourses.length) {
      return redirect("/preview");
    }
  }

  const product = await stripe.products.retrieve("prod_QFenLoxmawFmBo");
  if (!product.default_price) {
    throw new Error("Product has no default price");
  }

  const price = await stripe.prices.retrieve(product.default_price as string);
  return json({ course, product, price });
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const course = await db.course.findUniqueOrThrow({
    where: { host: url.host },
  });

  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: course.stripePriceId, quantity: 1 }],
    mode: "payment",
    success_url: `https://${url.host}/purchase?success=true`,
    cancel_url: `https://${url.host}/purchase?canceled=true`,
  });

  return redirect(session.url ?? "/", { status: 303 });
}

export default function Purchase() {
  const [searchParams] = useSearchParams();
  const { product, price } = useLoaderData<typeof loader>();
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [canceledModalOpen, setCanceledModalOpen] = useState(false);

  const formattedPrice = Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
  }).format(price.unit_amount ? price.unit_amount / 100 : 0);

  const isSuccessful = searchParams.get("success") === "true";
  const isCanceled = searchParams.get("canceled") === "true";

  // handle success or cancel
  useEffect(() => {
    if (isSuccessful) {
      setSuccessModalOpen(true);
    } else if (isCanceled) {
      setCanceledModalOpen(true);
    }
  }, [isSuccessful, isCanceled]);

  return (
    <>
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
      <PurchaseSuccessModal open={successModalOpen} onOpenChange={setSuccessModalOpen} />
      <PurchaseCanceledModal open={canceledModalOpen} onOpenChange={setCanceledModalOpen} />
    </>
  );
}
