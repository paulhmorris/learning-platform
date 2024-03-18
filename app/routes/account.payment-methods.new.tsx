import { Link } from "@remix-run/react";
import { IconArrowLeft } from "@tabler/icons-react";

import { PaymentMethodForm } from "~/components/account/payment-method-form";

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
