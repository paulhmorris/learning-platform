import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { PageTitle } from "~/components/common/page-title";
import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const { stripeId } = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeId: true },
  });

  if (!stripeId) {
    throw redirect("/account/payment-methods/new");
  }

  const methods = stripe.customers.listPaymentMethods(stripeId);
  return typedjson({ methods });
}

export default function AccountLayout() {
  const { methods } = useTypedLoaderData<typeof loader>();

  return (
    <div className="border-purple-700 p-6">
      <PageTitle>Payment Methods</PageTitle>
      <Link to="/account/payment-methods/new">Add New</Link>
      <pre className="text-xs">{JSON.stringify(methods, null, 2)}</pre>
    </div>
  );
}
