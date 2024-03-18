import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, MetaFunction } from "@remix-run/react";
import { IconCreditCard } from "@tabler/icons-react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";

import { Button } from "~/components/ui/button";
import { db } from "~/integrations/db.server";
import { stripe } from "~/integrations/stripe.server";
import { SessionService } from "~/services/SessionService.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await SessionService.requireUserId(request);

  const { stripeId } = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeId: true },
  });

  const methods = stripeId ? stripe.customers.listPaymentMethods(stripeId) : [];
  return typedjson({ methods });
}

export const meta: MetaFunction = () => [{ title: "Payment Methods" }];

export default function AccountLayout() {
  const { methods } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Button variant="admin" asChild className="sm:w-auto">
        <Link to="/account/payment-methods/new">
          <IconCreditCard className="size-5" />
          <span>Add Card</span>
        </Link>
      </Button>
    </>
  );
}
