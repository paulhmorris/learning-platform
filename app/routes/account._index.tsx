import { Link } from "@remix-run/react";

import { PageTitle } from "~/components/page-header";

export default function AccountLayout() {
  return (
    <>
      <PageTitle>Account Index</PageTitle>
      <div className="flex flex-col gap-4">
        <Link to="/account/payment-methods">Payment Methods</Link>
        <Link to="/account/profile">Profile</Link>
      </div>
    </>
  );
}
