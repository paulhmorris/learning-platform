import { useSearchParams } from "@remix-run/react";

import { PageTitle } from "~/components/page-header";

export default function PleaseVerifyEmail() {
  const [searchParams] = useSearchParams();
  return (
    <div className="space-y-2 text-center">
      <PageTitle>Verify Your Email</PageTitle>
      <p>
        We sent an email {searchParams.get("email") ? `to ${searchParams.get("email")}` : null} with a link to verify
        your email address. Please check your inbox and click the link to continue.
      </p>
    </div>
  );
}
