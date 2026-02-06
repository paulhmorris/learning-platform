import { SignUp } from "@clerk/react-router";
import { useEffect } from "react";

import { Analytics } from "~/integrations/mixpanel.client";
import { AUTH_PAGE_KEY } from "~/lib/constants";

export default function SignUpPage() {
  useEffect(() => {
    sessionStorage.setItem(AUTH_PAGE_KEY, "/sign-up");
    Analytics.trackEvent("sign_up_started");
  }, []);

  return (
    <>
      <title>Sign Up | Plumb Media & Education</title>
      <div className="flex min-h-dvh w-dvw items-start justify-center pt-[clamp(2rem,10vw,5rem)]">
        <SignUp />
      </div>
    </>
  );
}
