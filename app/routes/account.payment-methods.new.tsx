import { LoaderFunctionArgs } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { typedjson } from "remix-typedjson";

import { PaymentMethodForm } from "~/components/account/payment-method-form";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/SessionService.server";
import { TypedMetaFunction } from "~/types/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUserId(request);
  return typedjson({});
}

export const meta: TypedMetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // @ts-expect-error typed meta funtion doesn't support this yet
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return [{ title: `New Payment Method | ${match?.data?.attributes.title}` }];
};

export default function NewPaymentMethod() {
  return (
    <>
      <Link to="/account/payment-methods" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <IconArrowLeft className="size-4" />
        <span>Back to payment methods</span>
      </Link>

      <PaymentMethodForm />
    </>
  );
}
