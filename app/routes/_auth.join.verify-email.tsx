import { useSearchParams } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { useState } from "react";
import { ValidatedForm } from "remix-validated-form";
import { z } from "zod";

import { AuthCard } from "~/components/common/auth-card";
import { PageTitle } from "~/components/page-header";

const validator = withZod(
  z.object({
    email: z.string().email(),
    token: z.string().length(6),
  }),
);

export default function PleaseVerifyEmail() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState("");

  return (
    <>
      <PageTitle className="text-center">Verify Your Email</PageTitle>
      <AuthCard>
        <p className="text-center">
          Please enter the six digit code we emailed
          {searchParams.get("email") ? ` to ${searchParams.get("email")}` : null}
        </p>
        <ValidatedForm validator={validator} method="post" className="w-full">
          <input type="hidden" name="token" value={token} />
          inpu
        </ValidatedForm>
      </AuthCard>
    </>
  );
}
