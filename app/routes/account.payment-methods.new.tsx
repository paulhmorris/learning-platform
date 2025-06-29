import { IconArrowLeft } from "@tabler/icons-react";
import { Link, LoaderFunctionArgs, MetaFunction } from "react-router";

import { PaymentMethodForm } from "~/components/account/payment-method-form";
import { ErrorComponent } from "~/components/error-component";
import { loader as rootLoader } from "~/root";
import { SessionService } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await SessionService.requireUserId(request);
  return {};
}

export const meta: MetaFunction<typeof loader, { root: typeof rootLoader }> = ({ matches }) => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const match = matches.find((m) => m.id === "root")?.data.course;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return [{ title: `New Payment Method | ${match?.data?.attributes.title ?? "Plumb Media & Education"}` }];
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

export function ErrorBoundary() {
  return <ErrorComponent />;
}
